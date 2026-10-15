'use strict';

/**
 * Admin / dispatcher overrides (Section 23): manual assign, manual reassign, "auto-assign now".
 * Automatic assignment + admin override = hybrid assignment.
 */

const ServiceRequest = require('../models/ServiceRequest');
const Technician = require('../models/Technician');
const ApiError = require('../utils/ApiError');
const { runExclusive } = require('../utils/mutex');
const { addMinutes } = require('../utils/time');
const { getSettings } = require('./settingsService');
const assignmentService = require('./assignmentService');
const technicianService = require('./technicianService');
const { notify, broadcastRequestUpdate } = require('./notificationService');

const REASSIGNABLE = ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'];

async function manualAssign(requestId, technicianId, admin, { force = false, reason = '' } = {}) {
  return runExclusive('assignment', async () => {
    const request = await ServiceRequest.findById(requestId);
    if (!request) throw ApiError.notFound('Request not found');
    if (!REASSIGNABLE.includes(request.status)) throw ApiError.conflict(`A ${request.status.toLowerCase().replace(/_/g, ' ')} request cannot be (re)assigned`);

    const tech = await Technician.findById(technicianId);
    if (!tech || tech.deletedAt) throw ApiError.notFound('Technician not found');
    if (tech.verificationStatus !== 'APPROVED') throw ApiError.badRequest('Only verified technicians can receive jobs');
    if (!tech.isActive) throw ApiError.badRequest('This technician is deactivated');
    if (request.technicianId && request.technicianId.equals(tech._id)) throw ApiError.conflict('The request is already assigned to this technician');

    const settings = await getSettings();
    const warnings = [];
    if (!tech.skills.includes(request.serviceSlug)) warnings.push('MISSING_SKILL');
    const free = await assignmentService.checkTechnicianFreeAt(tech._id, request, request.scheduledAt, settings);
    if (!free.ok) warnings.push(free.reason);
    if (warnings.length && !force) {
      throw ApiError.conflict(`Technician does not meet the normal requirements (${warnings.join(', ')}). Confirm to override.`, { code: 'NEEDS_FORCE', warnings });
    }

    const now = new Date();
    const previousTechId = request.technicianId;
    const expiresAt = addMinutes(now, settings.responseTimeoutMinutes[request.urgency] || 10);

    const updated = await ServiceRequest.findOneAndUpdate(
      { _id: request._id, status: request.status, technicianId: previousTechId },
      {
        $set: {
          status: 'ASSIGNED',
          technicianId: tech._id,
          acceptedAt: null,
          'assignment.mode': 'MANUAL',
          'assignment.score': null,
          'assignment.offeredAt': now,
          'assignment.expiresAt': expiresAt,
          'assignment.etaStart': null,
          'assignment.needsAdmin': false,
          'assignment.nextAvailableSlot': null,
          'assignment.lastRunAt': now,
        },
        $pull: { 'assignment.excludedTechnicianIds': tech._id },
        $push: {
          statusHistory: { status: 'ASSIGNED', at: now, by: admin._id, byRole: 'ADMIN', note: `${previousTechId ? 'Reassigned' : 'Assigned'} by ${admin.name} to ${tech.name}${force && warnings.length ? ' (override)' : ''}${reason ? ` - ${reason}` : ''}` },
          'assignment.attempts': { technicianId: tech._id, technicianName: tech.name, mode: 'MANUAL', outcome: 'PENDING', at: now, reason: reason || undefined },
        },
      },
      { new: true }
    );
    if (!updated) throw ApiError.conflict('The request changed while you were assigning it - please refresh');

    if (previousTechId) {
      await ServiceRequest.updateOne(
        { _id: updated._id },
        {
          $addToSet: { 'assignment.excludedTechnicianIds': previousTechId },
          $set: { 'assignment.attempts.$[a].outcome': 'REASSIGNED', 'assignment.attempts.$[a].resolvedAt': now },
        },
        { arrayFilters: [{ 'a.technicianId': previousTechId, 'a.outcome': { $in: ['PENDING', 'ACCEPTED'] } }] }
      );
      const prev = await Technician.findById(previousTechId);
      if (prev) {
        await notify(prev.userId, {
          title: 'Assignment changed',
          message: `Request #${updated.requestNumber} was reassigned to another technician by the dispatcher.`,
          type: 'ASSIGNMENT_CHANGED',
          data: { requestId: updated._id.toString(), requestNumber: updated.requestNumber },
        });
        await technicianService.syncTechnicianState(prev._id);
        broadcastRequestUpdate(updated, prev.userId);
      }
    }

    await assignmentService.onAssigned(updated, { userId: tech.userId, name: tech.name }, { auto: false, expiresAt });
    if (previousTechId) {
      await notify(updated.customerId, {
        title: 'Your technician has changed',
        message: `Request #${updated.requestNumber}: ${tech.name} is now assigned to you.`,
        type: 'ASSIGNMENT_CHANGED',
        data: { requestId: updated._id.toString(), requestNumber: updated.requestNumber, link: `/customer/request/${updated._id}` },
      });
    }
    await technicianService.syncTechnicianState(tech._id);
    return { request: updated, technician: tech, warnings, previousTechnicianId: previousTechId };
  });
}

/**
 * Run the automatic engine now. If a technician currently holds the job it is released first
 * (and excluded), so the engine picks the next best one.
 */
async function autoAssignNow(requestId, admin, { resetExclusions = false } = {}) {
  const request = await ServiceRequest.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  if (!REASSIGNABLE.includes(request.status)) throw ApiError.conflict('This request can no longer be assigned');

  if (request.technicianId) {
    const prevId = request.technicianId;
    const prev = await Technician.findById(prevId);
    const out = await assignmentService.releaseTechnician(request._id, prevId, {
      outcome: 'REASSIGNED',
      reason: `Reassigned by ${admin.name}`,
      allowedStatuses: ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'],
      byUser: null,
      autoReassign: false,
    });
    if (!out.released) throw ApiError.conflict('The request changed - please refresh');
    if (prev) {
      await notify(prev.userId, { title: 'Assignment changed', message: `Request #${request.requestNumber} was reassigned by the dispatcher.`, type: 'ASSIGNMENT_CHANGED', data: { requestNumber: request.requestNumber } });
      await technicianService.syncTechnicianState(prev._id);
    }
  }

  await ServiceRequest.updateOne(
    { _id: request._id, status: 'SUBMITTED' },
    {
      $set: { 'assignment.autoDisabled': false, 'assignment.attemptsResetAt': new Date(), ...(resetExclusions ? { 'assignment.excludedTechnicianIds': [] } : {}) },
    }
  );
  const result = await assignmentService.assignRequest(request._id, { actor: admin._id });
  return { ...result, request: await ServiceRequest.findById(request._id) };
}

module.exports = { manualAssign, autoAssignNow, REASSIGNABLE };
