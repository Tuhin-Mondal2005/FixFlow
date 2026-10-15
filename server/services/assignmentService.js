'use strict';

/**
 * ============================================================================
 *  FixFlow - Intelligent Technician Assignment Engine  (Sections 17-24, 28, 61-63)
 * ============================================================================
 *  Pipeline for one request:
 *   1. get the service requirement (skill key, duration, minimum experience)
 *   2. load VERIFIED technicians
 *   3. HARD FILTERS (an ineligible technician can never win with a "good" score):
 *        verified -> active -> has skill -> experience -> status (not OFFLINE/ON_LEAVE)
 *        -> inside their service radius -> inside working hours -> free at the requested time
 *   4. SOFT FACTORS (0-100 each): skill, availability, location(distance), workload, rating, experience
 *   5. weighted score  = sum(weight_i * factor_i) / sum(weight_i)      (weights come from Settings)
 *   6. rank (ties: lower workload, shorter distance, higher rating)
 *   7. atomically claim the request for the best technician -> status ASSIGNED + response deadline
 *   8. notify technician + customer (Socket.IO + DB notification)
 *  Fallbacks: reject / timeout / no-show => next best technician (auto-reassignment);
 *             nobody eligible => compute the next available slot and flag the request for the admin.
 *  Priority (LOW 20 / MEDIUM 50 / HIGH 100) controls QUEUE ORDER and the response deadline,
 *  suitability is always decided by eligibility + score.
 * ============================================================================
 */

const Technician = require('../models/Technician');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const { haversineKm, round1, round2 } = require('../utils/geo');
const { runExclusive } = require('../utils/mutex');
const { minutesOfDayInBusinessTz, toMinutes, addMinutes } = require('../utils/time');
const { getSettings } = require('./settingsService');
const { notify, notifyAdmins, broadcastRequestUpdate } = require('./notificationService');
const { ACTIVE_JOB_STATUSES, IN_PROGRESS_STATUSES } = require('../config/constants');

const {
  clamp,
  locationFactor,
  workloadFactor,
  ratingFactor,
  experienceFactor,
  computeScore,
  overlaps,
} = require('./scoring');

const DEFAULT_AVAILABILITY_FACTOR_FREE = 100; // AVAILABLE and idle at the requested time
const DEFAULT_AVAILABILITY_FACTOR_BUSY_FREE_BY_START = 85; // BUSY now but free again before the slot

/* ------------------------------------------------------------------ */
/*  Candidate ranking                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rank technicians for a request WITHOUT changing anything (also used by the admin "candidates" preview).
 * @returns {{ranked: object[], rejected: object[], nextAvailableSlot: Date|null, requestedStart: Date}}
 */
async function rankTechnicians(request, service, settings, { excludeIds = [], now = new Date() } = {}) {
  const exclude = new Set(excludeIds.map(String));
  const weights = settings.assignmentWeights;
  const isHigh = request.urgency === 'HIGH';
  const duration = request.durationMinutes || service.durationMinutes || 60;
  const buffer = settings.travelBufferMinutes;

  // The service is needed at the preferred time, never in the past
  const requestedStart = request.scheduledAt > now ? request.scheduledAt : now;
  const requestedEnd = addMinutes(requestedStart, duration);
  // "Immediate" requests may also use technicians who free up shortly (Section 8 / 63: future availability)
  const isImmediate = isHigh || request.scheduledAt <= addMinutes(now, 15);

  // Step 2: verified technicians. (Skill / active / status are filtered below so we can explain WHY.)
  const technicians = await Technician.find({ verificationStatus: 'APPROVED', deletedAt: null }).lean();
  if (!technicians.length) return { ranked: [], rejected: [], nextAvailableSlot: null, requestedStart };

  const techIds = technicians.map((t) => t._id);
  const activeJobs = await ServiceRequest.find({
    technicianId: { $in: techIds },
    status: { $in: ACTIVE_JOB_STATUSES },
    _id: { $ne: request._id },
  })
    .select('technicianId scheduledAt durationMinutes status')
    .lean();

  const jobsByTech = new Map();
  for (const j of activeJobs) {
    const key = j.technicianId.toString();
    if (!jobsByTech.has(key)) jobsByTech.set(key, []);
    jobsByTech.get(key).push(j);
  }

  const ranked = [];
  const rejected = [];
  const futureCandidates = []; // skill-matched technicians for "next available slot" suggestion

  for (const tech of technicians) {
    const reject = (reason) => rejected.push({ technicianId: tech._id, name: tech.name, reason });
    const id = tech._id.toString();

    // ---- HARD FILTERS --------------------------------------------------
    if (exclude.has(id)) { reject('ALREADY_TRIED'); continue; }
    if (!tech.isActive) { reject('INACTIVE'); continue; }
    if (!tech.skills.includes(service.slug)) { reject('MISSING_SKILL'); continue; }
    if ((tech.experience || 0) < (service.minExperienceYears || 0)) { reject('INSUFFICIENT_EXPERIENCE'); continue; }

    const radius = tech.serviceRadiusKm || settings.defaultServiceRadiusKm;
    const distanceKm = haversineKm(tech.location.latitude, tech.location.longitude, request.location.latitude, request.location.longitude);
    if (distanceKm > radius) { reject('OUTSIDE_SERVICE_AREA'); continue; }

    const myJobs = jobsByTech.get(id) || [];
    // For the "next slot" suggestion we keep everyone who is qualified, in range and not on leave/offline.
    const statusOk = tech.availabilityStatus === 'AVAILABLE' || tech.availabilityStatus === 'BUSY';
    if (!statusOk) { reject(`STATUS_${tech.availabilityStatus}`); continue; }
    futureCandidates.push({ tech, myJobs });

    // Working hours (emergencies are served around the clock)
    if (!isHigh) {
      const startMin = minutesOfDayInBusinessTz(requestedStart);
      const endMin = startMin + duration;
      const ws = toMinutes(tech.workingHours?.start || '00:00');
      const we = toMinutes(tech.workingHours?.end || '23:59');
      if (startMin < ws || endMin > we) { reject('OUTSIDE_WORKING_HOURS'); continue; }
    }

    // Free at the required time? A job occupies [scheduledAt - buffer, scheduledAt + duration + buffer].
    let effectiveStart = requestedStart;
    let availabilityFactor = DEFAULT_AVAILABILITY_FACTOR_FREE;

    if (tech.availabilityStatus === 'BUSY') {
      const freeFrom = tech.availableFrom ? new Date(tech.availableFrom) : null;
      if (freeFrom && freeFrom <= requestedStart) {
        availabilityFactor = DEFAULT_AVAILABILITY_FACTOR_BUSY_FREE_BY_START;
      } else if (freeFrom && isImmediate && (freeFrom - now) / 60000 <= settings.maxWaitMinutes) {
        // Becomes available soon - allowed for urgent requests with a longer wait => lower factor
        const waitMin = Math.max(0, (freeFrom - requestedStart) / 60000);
        effectiveStart = freeFrom;
        availabilityFactor = clamp(70 - 40 * (waitMin / Math.max(settings.maxWaitMinutes, 1)), 20, 70);
      } else {
        reject('BUSY_AT_REQUESTED_TIME');
        continue;
      }
    }

    const effectiveEnd = addMinutes(effectiveStart, duration);
    let conflict = false;
    for (const j of myJobs) {
      const jStart = addMinutes(j.scheduledAt, -buffer);
      let jEnd = addMinutes(j.scheduledAt, (j.durationMinutes || 60) + buffer);
      if (IN_PROGRESS_STATUSES.includes(j.status) && jEnd < now) jEnd = addMinutes(now, 30); // overrunning job
      if (overlaps(effectiveStart, effectiveEnd, jStart, jEnd)) { conflict = true; break; }
    }
    if (conflict) { reject('TIME_CONFLICT'); continue; }

    // ---- SOFT FACTORS --------------------------------------------------
    const factors = {
      skill: 100, // exact skill is a hard filter, so everybody that reaches here matches fully
      availability: availabilityFactor,
      location: locationFactor(distanceKm, radius),
      workload: workloadFactor(myJobs.length, settings.maxWorkload),
      rating: ratingFactor(tech.rating, tech.ratingCount),
      experience: experienceFactor(tech.experience),
    };
    const score = computeScore(factors, weights);

    ranked.push({
      technicianId: tech._id,
      userId: tech.userId,
      name: tech.name,
      score,
      factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, round1(v)])),
      distanceKm: round1(distanceKm),
      activeJobs: myJobs.length,
      rating: tech.rating,
      experience: tech.experience,
      etaStart: effectiveStart > requestedStart ? effectiveStart : null,
    });
  }

  // Step 6 - rank. Ties: fewer jobs, closer, better rated.
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.activeJobs - b.activeJobs ||
      a.distanceKm - b.distanceKm ||
      b.rating - a.rating ||
      String(a.technicianId).localeCompare(String(b.technicianId))
  );

  // Nobody suitable right now? Find the earliest moment a qualified technician becomes free.
  let nextAvailableSlot = null;
  if (!ranked.length) {
    for (const { tech, myJobs } of futureCandidates) {
      let free = now;
      if (tech.availabilityStatus === 'BUSY' && tech.availableFrom && new Date(tech.availableFrom) > free) free = new Date(tech.availableFrom);
      for (const j of myJobs) {
        const jEnd = addMinutes(j.scheduledAt, (j.durationMinutes || 60) + buffer);
        if (jEnd > free && jEnd > now) free = jEnd;
      }
      if (!nextAvailableSlot || free < nextAvailableSlot) nextAvailableSlot = free;
    }
  }

  return { ranked, rejected, nextAvailableSlot, requestedStart, requestedEnd };
}

/**
 * Can this technician serve `request` at `newStart`? Used when a customer reschedules (Section 27):
 * the same hard filters (status, working hours, busy-until, overlapping jobs) are re-checked.
 */
async function checkTechnicianFreeAt(technicianId, request, newStart, settings) {
  const tech = await Technician.findById(technicianId).lean();
  if (!tech || tech.verificationStatus !== 'APPROVED' || !tech.isActive || tech.deletedAt) return { ok: false, reason: 'TECHNICIAN_UNAVAILABLE' };
  if (!['AVAILABLE', 'BUSY'].includes(tech.availabilityStatus)) return { ok: false, reason: `STATUS_${tech.availabilityStatus}` };

  const now = new Date();
  const start = newStart > now ? newStart : now;
  const duration = request.durationMinutes || 60;
  const end = addMinutes(start, duration);

  if (request.urgency !== 'HIGH') {
    const startMin = minutesOfDayInBusinessTz(start);
    if (startMin < toMinutes(tech.workingHours?.start || '00:00') || startMin + duration > toMinutes(tech.workingHours?.end || '23:59')) {
      return { ok: false, reason: 'OUTSIDE_WORKING_HOURS' };
    }
  }
  if (tech.availabilityStatus === 'BUSY' && !(tech.availableFrom && new Date(tech.availableFrom) <= start)) return { ok: false, reason: 'BUSY_AT_REQUESTED_TIME' };

  const jobs = await ServiceRequest.find({ technicianId, status: { $in: ACTIVE_JOB_STATUSES }, _id: { $ne: request._id } }).select('scheduledAt durationMinutes status').lean();
  for (const j of jobs) {
    const jStart = addMinutes(j.scheduledAt, -settings.travelBufferMinutes);
    let jEnd = addMinutes(j.scheduledAt, (j.durationMinutes || 60) + settings.travelBufferMinutes);
    if (IN_PROGRESS_STATUSES.includes(j.status) && jEnd < now) jEnd = addMinutes(now, 30);
    if (overlaps(start, end, jStart, jEnd)) return { ok: false, reason: 'TIME_CONFLICT' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Assignment (claiming a request)                                     */
/* ------------------------------------------------------------------ */

const topRanking = (ranked) =>
  ranked.slice(0, 5).map((r) => ({
    technicianId: r.technicianId,
    name: r.name,
    score: r.score,
    factors: r.factors,
    distanceKm: r.distanceKm,
    activeJobs: r.activeJobs,
  }));

/** Core routine - must be called inside the assignment mutex. */
async function assignInsideLock(requestId, { actor = null, extraExcludeIds = [] } = {}) {
  const request = await ServiceRequest.findById(requestId);
  if (!request) return { assigned: false, reason: 'NOT_FOUND' };
  if (request.status !== 'SUBMITTED' || request.technicianId) return { assigned: false, reason: 'NOT_ASSIGNABLE' };
  if (request.assignment.autoDisabled) return { assigned: false, reason: 'AUTO_DISABLED' };

  const settings = await getSettings();
  const resetAt = request.assignment.attemptsResetAt;
  const autoAttempts = request.assignment.attempts.filter((a) => a.mode === 'AUTO' && (!resetAt || a.at > resetAt)).length;
  if (autoAttempts >= settings.maxAutoAttempts) {
    await ServiceRequest.updateOne(
      { _id: request._id },
      { $set: { 'assignment.autoDisabled': true, 'assignment.needsAdmin': true, 'assignment.lastRunAt': new Date() } }
    );
    await notifyAdmins({
      title: 'Manual assignment needed',
      message: `Request #${request.requestNumber} (${request.serviceName}) exhausted automatic assignment attempts.`,
      type: 'ADMIN_ATTENTION',
      data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/admin/requests/${request._id}` },
    });
    return { assigned: false, reason: 'MAX_ATTEMPTS' };
  }

  const service = await Service.findById(request.serviceId);
  if (!service) return { assigned: false, reason: 'SERVICE_MISSING' };

  const exclude = [...request.assignment.excludedTechnicianIds.map(String), ...extraExcludeIds.map(String)];
  const { ranked, nextAvailableSlot } = await rankTechnicians(request, service, settings, { excludeIds: exclude });

  if (!ranked.length) {
    const wasFlagged = request.assignment.needsAdmin;
    await ServiceRequest.updateOne(
      { _id: request._id, status: 'SUBMITTED' },
      { $set: { 'assignment.needsAdmin': true, 'assignment.nextAvailableSlot': nextAvailableSlot, 'assignment.lastRanking': [], 'assignment.lastRunAt': new Date() } }
    );
    if (!wasFlagged) {
      const slotText = nextAvailableSlot ? ` Next available slot: ${nextAvailableSlot.toISOString()}.` : '';
      await notify(request.customerId, {
        title: 'Finding a technician',
        message: `No technician is free right now for request #${request.requestNumber}. We keep searching and our team has been alerted.${slotText ? ' Earliest possible slot is shown on your request.' : ''}`,
        type: 'NO_TECHNICIAN_YET',
        data: { requestId: request._id.toString(), requestNumber: request.requestNumber, nextAvailableSlot },
      });
      await notifyAdmins({
        title: request.urgency === 'HIGH' ? '🚨 Emergency request has no technician' : 'Request has no available technician',
        message: `Request #${request.requestNumber} (${request.serviceName}, ${request.urgency}) needs attention.${slotText}`,
        type: 'ADMIN_ATTENTION',
        data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/admin/requests/${request._id}` },
      });
    }
    return { assigned: false, reason: 'NO_ELIGIBLE_TECHNICIAN', nextAvailableSlot };
  }

  const best = ranked[0];
  const now = new Date();
  const timeoutMin = settings.responseTimeoutMinutes[request.urgency] || 10;
  const expiresAt = addMinutes(now, timeoutMin);

  // Atomic claim: only succeeds if nobody (e.g. an admin) took the request in the meantime
  const updated = await ServiceRequest.findOneAndUpdate(
    { _id: request._id, status: 'SUBMITTED', technicianId: null },
    {
      $set: {
        status: 'ASSIGNED',
        technicianId: best.technicianId,
        'assignment.mode': 'AUTO',
        'assignment.score': best.score,
        'assignment.offeredAt': now,
        'assignment.expiresAt': expiresAt,
        'assignment.etaStart': best.etaStart,
        'assignment.needsAdmin': false,
        'assignment.nextAvailableSlot': null,
        'assignment.lastRanking': topRanking(ranked),
        'assignment.lastRunAt': now,
      },
      $push: {
        statusHistory: { status: 'ASSIGNED', at: now, byRole: actor ? 'ADMIN' : 'SYSTEM', by: actor || undefined, note: `Auto-assigned to ${best.name} (score ${best.score})` },
        'assignment.attempts': { technicianId: best.technicianId, technicianName: best.name, score: best.score, mode: 'AUTO', outcome: 'PENDING', at: now },
      },
    },
    { new: true }
  );
  if (!updated) return { assigned: false, reason: 'RACE_LOST' };

  await onAssigned(updated, best, { auto: true, expiresAt });
  return { assigned: true, technicianId: best.technicianId, score: best.score, request: updated };
}

/** Notifications + live events after a technician has been offered the job. */
async function onAssigned(request, candidate, { auto, expiresAt }) {
  const dateText = request.scheduledAt.toISOString();
  await notify(candidate.userId, {
    title: request.urgency === 'HIGH' ? '🚨 Urgent service request' : 'New service request',
    message: `${request.serviceName} – ${request.location.address.split(',')[0]} (${request.urgency}). Please accept or reject${expiresAt ? ' before it expires' : ''}.`,
    type: 'JOB_ASSIGNED',
    data: { requestId: request._id.toString(), requestNumber: request.requestNumber, expiresAt, scheduledAt: dateText, link: `/technician/jobs/${request._id}` },
  });
  await notify(request.customerId, {
    title: 'Technician assigned',
    message: `${candidate.name} has been matched to request #${request.requestNumber}. Waiting for their confirmation.`,
    type: 'TECHNICIAN_ASSIGNED',
    data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/customer/request/${request._id}` },
  });
  broadcastRequestUpdate(request, candidate.userId);
  return auto;
}

/** Public entry: serialised assignment of one request. */
function assignRequest(requestId, opts) {
  return runExclusive('assignment', () => assignInsideLock(requestId, opts));
}

/* ------------------------------------------------------------------ */
/*  Emergency / priority queue (Section 22)                             */
/* ------------------------------------------------------------------ */

/** Process every unassigned request, HIGH priority first, then oldest first. */
function processQueue() {
  return runExclusive('assignment', async () => {
    const pending = await ServiceRequest.find({
      status: 'SUBMITTED',
      technicianId: null,
      'assignment.autoDisabled': { $ne: true },
    })
      .sort({ priority: -1, createdAt: 1 })
      .select('_id priority requestNumber')
      .lean();
    const results = [];
    for (const p of pending) {
      const r = await assignInsideLock(p._id);
      results.push({ requestId: p._id, requestNumber: p.requestNumber, priority: p.priority, ...{ assigned: r.assigned, reason: r.reason } });
    }
    return results;
  });
}

/* ------------------------------------------------------------------ */
/*  Rejection / timeout / no-show => next best technician               */
/* ------------------------------------------------------------------ */

/**
 * Release the currently assigned technician (atomic) and optionally search for the next one.
 * @param outcome REJECTED | TIMEOUT | NO_SHOW | REASSIGNED | DEACTIVATED | RESCHEDULED
 */
async function releaseTechnician(requestId, technicianId, { outcome, reason = '', allowedStatuses = ['ASSIGNED'], byUser = null, autoReassign = true }) {
  const now = new Date();
  const filter = { _id: requestId, technicianId, status: { $in: allowedStatuses } };
  const current = await ServiceRequest.findOne(filter).select('assignment.mode urgency');
  if (!current) return { released: false };
  const wasManual = current.assignment.mode === 'MANUAL';

  const request = await ServiceRequest.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'SUBMITTED',
        technicianId: null,
        'assignment.expiresAt': null,
        'assignment.etaStart': null,
        'assignment.score': null,
        'assignment.mode': null,
        // an admin hand-picked technician refusing => back to the admin, not auto-loop
        ...(wasManual && ['REJECTED', 'TIMEOUT'].includes(outcome) ? { 'assignment.autoDisabled': true, 'assignment.needsAdmin': true } : {}),
      },
      $addToSet: { 'assignment.excludedTechnicianIds': technicianId },
      $push: { statusHistory: { status: 'SUBMITTED', at: now, by: byUser || undefined, byRole: byUser ? 'TECHNICIAN' : 'SYSTEM', note: `Technician released (${outcome}${reason ? `: ${reason}` : ''})` } },
    },
    { new: true }
  );
  if (!request) return { released: false };

  // close the open attempt record
  await ServiceRequest.updateOne(
    { _id: requestId },
    { $set: { 'assignment.attempts.$[a].outcome': outcome, 'assignment.attempts.$[a].reason': reason, 'assignment.attempts.$[a].resolvedAt': now } },
    { arrayFilters: [{ 'a.technicianId': technicianId, 'a.outcome': 'PENDING' }] }
  );
  // Accepted attempts that are being released also need closing
  await ServiceRequest.updateOne(
    { _id: requestId },
    { $set: { 'assignment.attempts.$[a].outcome': outcome, 'assignment.attempts.$[a].reason': reason, 'assignment.attempts.$[a].resolvedAt': now } },
    { arrayFilters: [{ 'a.technicianId': technicianId, 'a.outcome': 'ACCEPTED' }] }
  );

  const fresh = await ServiceRequest.findById(requestId);
  const tech = await Technician.findById(technicianId).select('userId');
  broadcastRequestUpdate(fresh, tech && tech.userId);

  if (wasManual && ['REJECTED', 'TIMEOUT'].includes(outcome)) {
    await notifyAdmins({
      title: 'Manually assigned technician declined',
      message: `Request #${fresh.requestNumber} needs a new assignment (${outcome.toLowerCase()}).`,
      type: 'ADMIN_ATTENTION',
      data: { requestId: fresh._id.toString(), requestNumber: fresh.requestNumber, link: `/admin/requests/${fresh._id}` },
    });
    return { released: true, request: fresh, reassigned: false };
  }

  let result = null;
  if (autoReassign && !fresh.assignment.autoDisabled) result = await assignRequest(fresh._id);
  return { released: true, request: fresh, reassigned: !!(result && result.assigned), result };
}

/** Technician pressed "Reject". */
const handleRejection = (requestId, technicianId, userId, reason) =>
  releaseTechnician(requestId, technicianId, { outcome: 'REJECTED', reason, allowedStatuses: ['ASSIGNED'], byUser: userId });

/**
 * Sweeper (runs every few seconds): handles
 *  - offers nobody answered in time  -> TIMEOUT, release technician, auto reassign   (Section 28)
 *  - accepted jobs the technician never started in time -> NO_SHOW, release, auto reassign
 *  - queue retries for requests still waiting for a technician
 */
async function sweep() {
  const now = new Date();
  const settings = await getSettings();
  const summary = { timeouts: 0, noShows: 0 };

  const expired = await ServiceRequest.find({ status: 'ASSIGNED', 'assignment.expiresAt': { $lt: now } }).select('_id technicianId requestNumber').lean();
  for (const r of expired) {
    const out = await releaseTechnician(r._id, r.technicianId, { outcome: 'TIMEOUT', reason: 'No response within the allowed time' });
    if (out.released) {
      summary.timeouts += 1;
      const tech = await Technician.findByIdAndUpdate(r.technicianId, { $inc: { missedResponses: 1 } }, { new: true }).select('userId');
      if (tech) {
        await notify(tech.userId, {
          title: 'Request expired',
          message: `You did not respond to request #${r.requestNumber} in time, so it was offered to someone else.`,
          type: 'JOB_EXPIRED',
          data: { requestNumber: r.requestNumber },
        });
      }
    }
  }

  const graceCutoff = addMinutes(now, -settings.noShowGraceMinutes);
  const late = await ServiceRequest.find({ status: 'ACCEPTED', scheduledAt: { $lt: graceCutoff } }).select('_id technicianId requestNumber customerId').lean();
  for (const r of late) {
    const out = await releaseTechnician(r._id, r.technicianId, { outcome: 'NO_SHOW', reason: 'Technician did not start the job on time', allowedStatuses: ['ACCEPTED'] });
    if (out.released) {
      summary.noShows += 1;
      const tech = await Technician.findByIdAndUpdate(r.technicianId, { $inc: { noShows: 1 } }, { new: true }).select('userId');
      if (tech) {
        await notify(tech.userId, {
          title: 'Job reassigned (no-show)',
          message: `Request #${r.requestNumber} was moved to another technician because it was not started on time.`,
          type: 'ASSIGNMENT_CHANGED',
          data: { requestNumber: r.requestNumber },
        });
      }
      await notify(r.customerId, {
        title: 'We are finding you another technician',
        message: `Your technician could not make it for request #${r.requestNumber}. We are matching you with someone else.`,
        type: 'ASSIGNMENT_CHANGED',
        data: { requestId: r._id.toString(), requestNumber: r.requestNumber, link: `/customer/request/${r._id}` },
      });
    }
  }

  // Retry waiting requests (also covers "technician became available")
  await processQueue();
  return summary;
}

module.exports = {
  // pure helpers
  computeScore,
  locationFactor,
  workloadFactor,
  ratingFactor,
  experienceFactor,
  overlaps,
  // engine
  rankTechnicians,
  checkTechnicianFreeAt,
  assignRequest,
  processQueue,
  releaseTechnician,
  handleRejection,
  sweep,
  onAssigned,
};
