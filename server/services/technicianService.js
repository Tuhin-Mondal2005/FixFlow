'use strict';

const Technician = require('../models/Technician');
const ServiceRequest = require('../models/ServiceRequest');
const { ACTIVE_JOB_STATUSES, IN_PROGRESS_STATUSES } = require('../config/constants');
const { maskAadhaar } = require('../utils/mask');
const assignmentService = require('./assignmentService');
const { notify } = require('./notificationService');

/** Count of jobs a technician is currently committed to (workload, Section 21). */
const activeJobCount = (technicianId) => ServiceRequest.countDocuments({ technicianId, status: { $in: ACTIVE_JOB_STATUSES } });

/**
 * Re-derive the denormalised fields shown on dashboards (currentJobs, currentStatus) and keep
 * AVAILABLE / BUSY in sync with what the technician is actually doing. OFFLINE / ON_LEAVE are never overridden.
 */
async function syncTechnicianState(technicianId) {
  const tech = await Technician.findById(technicianId);
  if (!tech) return null;
  const jobs = await ServiceRequest.find({ technicianId, status: { $in: ACTIVE_JOB_STATUSES } })
    .select('status serviceName requestNumber scheduledAt durationMinutes')
    .sort({ scheduledAt: 1 })
    .lean();
  const inProgress = jobs.find((j) => IN_PROGRESS_STATUSES.includes(j.status));

  tech.currentJobs = jobs.length;
  tech.currentStatus = inProgress ? `On job: ${inProgress.serviceName} #${inProgress.requestNumber}` : jobs.length ? `${jobs.length} upcoming job(s)` : 'Idle';

  if (['AVAILABLE', 'BUSY'].includes(tech.availabilityStatus)) {
    const manualBusy = tech.availabilityStatus === 'BUSY' && !tech.busyBySystem; // chosen by the technician: never overridden while valid
    if (inProgress) {
      if (!manualBusy) {
        tech.availabilityStatus = 'BUSY';
        tech.busyBySystem = true;
        const end = new Date(inProgress.scheduledAt.getTime() + (inProgress.durationMinutes || 60) * 60000);
        tech.availableFrom = end > new Date() ? end : new Date(Date.now() + 30 * 60000);
      }
    } else if (tech.availabilityStatus === 'BUSY') {
      // Nothing in progress any more: release a BUSY the system set itself immediately (even if the job
      // finished before its scheduled end). A BUSY the technician set stays until its "available after" time.
      if (tech.busyBySystem || !tech.availableFrom || tech.availableFrom <= new Date()) {
        tech.availabilityStatus = 'AVAILABLE';
        tech.availableFrom = null;
        tech.busyBySystem = false;
      }
    } else {
      tech.busyBySystem = false;
    }
  }
  await tech.save();
  return tech;
}

/**
 * Periodic re-check (called by the sweeper): re-derives the state of every BUSY technician so stale
 * statuses clear on their own (system BUSY with no job in progress, or a manual BUSY that has expired).
 * Returns the number of technicians that became AVAILABLE.
 */
async function syncStaleBusy() {
  const candidates = await Technician.find({
    availabilityStatus: 'BUSY',
    $or: [{ busyBySystem: true }, { availableFrom: null }, { availableFrom: { $lte: new Date() } }],
  }).select('_id').lean();
  let freed = 0;
  for (const c of candidates) {
    const t = await syncTechnicianState(c._id);
    if (t && t.availabilityStatus === 'AVAILABLE') freed += 1;
  }
  return freed;
}

/**
 * Release every job a technician has not started yet (used when they go offline / on leave, get
 * deactivated or deleted). Offers are handed to the next best technician automatically.
 */
async function releaseOpenJobs(technician, { outcome, reason, includeAccepted = false }) {
  const statuses = includeAccepted ? ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'] : ['ASSIGNED'];
  const jobs = await ServiceRequest.find({ technicianId: technician._id, status: { $in: statuses } }).select('_id requestNumber customerId status');
  let released = 0;
  for (const job of jobs) {
    const out = await assignmentService.releaseTechnician(job._id, technician._id, { outcome, reason, allowedStatuses: statuses });
    if (out.released) {
      released += 1;
      await notify(technician.userId, {
        title: 'Assignment changed',
        message: `Request #${job.requestNumber} was moved to another technician (${reason || outcome.toLowerCase()}).`,
        type: 'ASSIGNMENT_CHANGED',
        data: { requestId: job._id.toString(), requestNumber: job.requestNumber },
      });
      if (job.status !== 'ASSIGNED') {
        await notify(job.customerId, {
          title: 'We are finding you another technician',
          message: `Your technician is no longer available for request #${job.requestNumber}. We are matching you with someone else.`,
          type: 'ASSIGNMENT_CHANGED',
          data: { requestId: job._id.toString(), requestNumber: job.requestNumber, link: `/customer/request/${job._id}` },
        });
      }
    }
  }
  await syncTechnicianState(technician._id);
  return released;
}

/** Recompute rating after a review: simple running average stored on the technician. */
async function applyRatingToTechnician(technicianId, newRating) {
  const tech = await Technician.findById(technicianId);
  if (!tech) return null;
  const total = tech.rating * tech.ratingCount + newRating;
  tech.ratingCount += 1;
  tech.rating = Math.round((total / tech.ratingCount) * 100) / 100;
  await tech.save();
  return tech;
}

/** Public-safe technician card shown to a customer whose job the technician has accepted. */
function publicTechnicianCard(tech, { revealPhone = false } = {}) {
  if (!tech) return null;
  return {
    _id: tech._id,
    name: tech.name,
    profilePhoto: tech.profilePhoto,
    experience: tech.experience,
    rating: tech.rating,
    ratingCount: tech.ratingCount,
    completedJobs: tech.completedJobs,
    skills: tech.skills,
    verified: tech.verificationStatus === 'APPROVED',
    phone: revealPhone ? tech.phone : undefined,
    liveLocation: tech.liveLocation && tech.liveLocation.latitude !== undefined ? tech.liveLocation : undefined,
  };
}

/** Admin view of a technician - Aadhaar is masked, document file names/paths are never included. */
function adminTechnicianView(tech) {
  const o = tech.toObject ? tech.toObject() : { ...tech };
  const docMeta = (d, kind, index) => ({ id: d._id, kind, index, originalName: d.originalName, mimeType: d.mimeType, size: d.size, uploadedAt: d.uploadedAt });
  return {
    ...o,
    aadhaarDocument: undefined,
    qualificationDocuments: undefined,
    aadhaarMasked: maskAadhaar(o.aadhaarLast4),
    aadhaarLast4: undefined,
    aadhaarNumberEncrypted: undefined,
    documents: {
      aadhaar: o.aadhaarDocument ? docMeta(o.aadhaarDocument, 'aadhaar', 0) : null,
      qualification: (o.qualificationDocuments || []).map((d, i) => docMeta(d, 'qualification', i)),
    },
  };
}

module.exports = {
  syncStaleBusy, activeJobCount, syncTechnicianState, releaseOpenJobs, applyRatingToTechnician, publicTechnicianCard, adminTechnicianView };
