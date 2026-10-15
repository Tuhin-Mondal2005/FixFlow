'use strict';

/**
 * Service-request lifecycle: creation, cancellation (rule enforced HERE, not in the UI),
 * rescheduling, technician transitions and the role-specific serialisation of a request.
 */

const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const Technician = require('../models/Technician');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { combineDateTime, startOfBusinessDay, addMinutes } = require('../utils/time');
const { haversineKm, round1 } = require('../utils/geo');
const {
  PRIORITY_VALUES,
  CUSTOMER_CANCELLABLE_STATUSES,
  TECHNICIAN_TRANSITIONS,
  STATUS_FLOW,
  ACTIVE_JOB_STATUSES,
} = require('../config/constants');
const { quotePrice } = require('./pricingService');
const { getSettings } = require('./settingsService');
const assignmentService = require('./assignmentService');
const technicianService = require('./technicianService');
const paymentService = require('./paymentService');
const { notify, notifyAdmins, broadcastRequestUpdate } = require('./notificationService');

const STEP_LABELS = {
  SUBMITTED: 'Request Submitted',
  ASSIGNED: 'Technician Assigned',
  ACCEPTED: 'Technician Accepted',
  ON_THE_WAY: 'Technician On the Way',
  ARRIVED: 'Technician Arrived',
  SERVICE_STARTED: 'Service Started',
  COMPLETED: 'Completed',
};

/* ------------------------------------------------------------------ */
/*  Creation                                                            */
/* ------------------------------------------------------------------ */

async function createRequest(user, data) {
  const service = await Service.findById(data.serviceId);
  if (!service || !service.isActive) throw ApiError.notFound('Service not found');
  const { price, packageName } = quotePrice(service, data.packageName);

  const scheduledAt = combineDateTime(data.preferredDate, data.preferredTime);
  if (Number.isNaN(scheduledAt.getTime())) throw ApiError.badRequest('Invalid preferred date or time');
  const now = new Date();
  if (scheduledAt < addMinutes(now, -10)) throw ApiError.badRequest('Preferred date/time is in the past');
  if (scheduledAt > addMinutes(now, 60 * 24 * 60)) throw ApiError.badRequest('Please choose a date within the next 60 days');

  const open = await ServiceRequest.countDocuments({ customerId: user._id, status: { $in: ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'] } });
  if (open >= 10) throw ApiError.conflict('You have too many open requests. Please complete or cancel some first.');

  const requestNumber = await Counter.next('request', 1000);
  const request = await ServiceRequest.create({
    requestNumber,
    customerId: user._id,
    serviceId: service._id,
    serviceName: service.name,
    serviceSlug: service.slug,
    category: service.category,
    packageName,
    problemDescription: data.problemDescription,
    urgency: data.urgency,
    priority: PRIORITY_VALUES[data.urgency],
    preferredDate: startOfBusinessDay(data.preferredDate),
    preferredTime: data.preferredTime,
    scheduledAt,
    durationMinutes: service.durationMinutes,
    contactNumber: data.contactNumber,
    location: { address: data.address, latitude: data.latitude, longitude: data.longitude },
    price,
    status: 'SUBMITTED',
    statusHistory: [{ status: 'SUBMITTED', at: now, by: user._id, byRole: 'CUSTOMER', note: 'Request submitted' }],
  });

  await notify(user._id, {
    title: 'Request submitted',
    message: `Request #${requestNumber} for ${service.name} was received. We are finding the best technician.`,
    type: 'REQUEST_SUBMITTED',
    data: { requestId: request._id.toString(), requestNumber, link: `/customer/request/${request._id}` },
  });
  if (data.urgency === 'HIGH') {
    await notifyAdmins({
      title: '🚨 Emergency request',
      message: `#${requestNumber} ${service.name} - HIGH priority`,
      type: 'EMERGENCY_REQUEST',
      data: { requestId: request._id.toString(), requestNumber, link: `/admin/requests/${request._id}` },
    });
  }
  broadcastRequestUpdate(request);

  // Run the queue (HIGH priority first) - an assignment hiccup must never lose the customer's request
  try {
    await assignmentService.processQueue();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[assignment] processQueue failed', err);
  }
  return ServiceRequest.findById(request._id);
}

/* ------------------------------------------------------------------ */
/*  Serialisation                                                       */
/* ------------------------------------------------------------------ */

function buildTimeline(request) {
  const idx = STATUS_FLOW.indexOf(request.status);
  const lastAt = {};
  for (const h of request.statusHistory || []) lastAt[h.status] = h.at;
  const steps = STATUS_FLOW.map((key, i) => ({
    key,
    label: STEP_LABELS[key],
    // a cancelled request keeps the steps it actually reached
    done: request.status === 'CANCELLED' ? key === 'SUBMITTED' || Boolean(lastAt[key]) : i <= idx,
    current: request.status !== 'CANCELLED' && i === idx,
    at: lastAt[key] || null,
  }));
  if (request.status === 'CANCELLED') steps.push({ key: 'CANCELLED', label: 'Cancelled', done: true, current: true, at: lastAt.CANCELLED || null });
  return steps;
}

const canCustomerCancel = (r) => CUSTOMER_CANCELLABLE_STATUSES.includes(r.status);

async function serializeForCustomer(request) {
  const o = request.toObject ? request.toObject() : request;
  let technician = null;
  if (o.technicianId) {
    const tech = await Technician.findById(o.technicianId);
    technician = technicianService.publicTechnicianCard(tech, { revealPhone: ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED', 'COMPLETED'].includes(o.status) });
  }
  const payment = await Payment.findOne({ requestId: o._id }).select('-gatewayOrderId');
  const rating = await Rating.findOne({ requestId: o._id }).select('rating comment createdAt');
  const { assignment, statusHistory: _h, ...rest } = o;
  return {
    ...rest,
    technician,
    timeline: buildTimeline(o),
    payment,
    rating,
    estimatedStart: assignment && assignment.etaStart ? assignment.etaStart : undefined,
    nextAvailableSlot: o.status === 'SUBMITTED' && assignment ? assignment.nextAvailableSlot : undefined,
    searching: o.status === 'SUBMITTED',
    canCancel: canCustomerCancel(o),
    canReschedule: canCustomerCancel(o) && (o.rescheduleCount || 0) < 3,
  };
}

/** What a technician may see. Exact coordinates + phone are revealed only after they ACCEPT. */
async function serializeForTechnician(request, technician) {
  const o = request.toObject ? request.toObject() : request;
  const customer = await User.findById(o.customerId).select('name phone');
  const payment = await Payment.findOne({ requestId: o._id }).select('amount method status');
  const revealed = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED', 'COMPLETED'].includes(o.status);
  const distanceKm = technician
    ? round1(haversineKm(technician.location.latitude, technician.location.longitude, o.location.latitude, o.location.longitude))
    : undefined;
  const base = {
    _id: o._id,
    requestNumber: o.requestNumber,
    serviceName: o.serviceName,
    packageName: o.packageName,
    category: o.category,
    problemDescription: o.problemDescription,
    urgency: o.urgency,
    priority: o.priority,
    preferredDate: o.preferredDate,
    preferredTime: o.preferredTime,
    scheduledAt: o.scheduledAt,
    durationMinutes: o.durationMinutes,
    status: o.status,
    price: o.price,
    finalAmount: o.finalAmount,
    paymentStatus: o.paymentStatus,
    payment: payment ? { _id: payment._id, amount: payment.amount, method: payment.method, status: payment.status } : null,
    distanceKm,
    expiresAt: o.status === 'ASSIGNED' ? o.assignment && o.assignment.expiresAt : undefined,
    estimatedStart: o.assignment && o.assignment.etaStart,
    timeline: buildTimeline(o),
    createdAt: o.createdAt,
    completedAt: o.completedAt,
    revealed,
  };
  if (revealed) {
    return { ...base, customer: { name: customer && customer.name, phone: o.contactNumber }, location: o.location };
  }
  // Before accepting: only the area + first name (privacy)
  return {
    ...base,
    customer: { name: customer ? customer.name.split(' ')[0] : 'Customer' },
    location: { address: o.location.address.split(',').slice(0, 2).join(',').trim() },
  };
}

/* ------------------------------------------------------------------ */
/*  Cancellation (Section 16)                                           */
/* ------------------------------------------------------------------ */

/**
 * The atomic filter on `status` is what enforces the rule: if the service has already started (or the
 * request is completed / cancelled) the update matches nothing and the cancellation is refused.
 */
async function cancelRequest(requestId, actor, reason = '') {
  const isAdmin = actor.role === 'ADMIN';
  const allowedStatuses = isAdmin ? ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'] : CUSTOMER_CANCELLABLE_STATUSES;
  const filter = { _id: requestId, status: { $in: allowedStatuses } };
  if (!isAdmin) filter.customerId = actor._id;

  const now = new Date();
  const before = await ServiceRequest.findOne(filter).select('technicianId status');
  if (!before) {
    const exists = await ServiceRequest.findOne(isAdmin ? { _id: requestId } : { _id: requestId, customerId: actor._id }).select('status');
    if (!exists) throw ApiError.notFound('Request not found');
    throw ApiError.conflict(
      exists.status === 'CANCELLED'
        ? 'This request is already cancelled'
        : exists.status === 'COMPLETED'
        ? 'A completed request cannot be cancelled'
        : 'The service has already started, so it can no longer be cancelled'
    );
  }

  const request = await ServiceRequest.findOneAndUpdate(
    { ...filter, status: before.status },
    {
      $set: { status: 'CANCELLED', cancelledBy: isAdmin ? 'ADMIN' : 'CUSTOMER', cancelReason: reason, 'assignment.expiresAt': null },
      $push: { statusHistory: { status: 'CANCELLED', at: now, by: actor._id, byRole: actor.role, note: reason || 'Cancelled' } },
    },
    { new: true }
  );
  if (!request) throw ApiError.conflict('The request changed state - please refresh and try again');

  if (before.technicianId) {
    await ServiceRequest.updateOne(
      { _id: request._id },
      { $set: { 'assignment.attempts.$[a].outcome': 'CANCELLED', 'assignment.attempts.$[a].resolvedAt': now } },
      { arrayFilters: [{ 'a.technicianId': before.technicianId, 'a.outcome': { $in: ['PENDING', 'ACCEPTED'] } }] }
    );
    const tech = await Technician.findById(before.technicianId);
    if (tech) {
      await notify(tech.userId, {
        title: 'Job cancelled',
        message: `Request #${request.requestNumber} (${request.serviceName}) was cancelled${isAdmin ? ' by the dispatcher' : ' by the customer'}.`,
        type: 'JOB_CANCELLED',
        data: { requestId: request._id.toString(), requestNumber: request.requestNumber },
      });
      await technicianService.syncTechnicianState(tech._id);
      broadcastRequestUpdate(request, tech.userId);
      // a technician just became free -> the queue may now find a match for waiting requests
      assignmentService.processQueue().catch(() => {});
    }
  } else {
    broadcastRequestUpdate(request);
  }
  if (isAdmin) {
    await notify(request.customerId, {
      title: 'Request cancelled',
      message: `Request #${request.requestNumber} was cancelled by our team. ${reason}`.trim(),
      type: 'REQUEST_CANCELLED',
      data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/customer/request/${request._id}` },
    });
  }
  return request;
}

/* ------------------------------------------------------------------ */
/*  Rescheduling (Section 27)                                           */
/* ------------------------------------------------------------------ */

async function rescheduleRequest(requestId, user, date, time) {
  const request = await ServiceRequest.findOne({ _id: requestId, customerId: user._id });
  if (!request) throw ApiError.notFound('Request not found');
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(request.status)) throw ApiError.conflict('A request can only be rescheduled before the service starts');
  if ((request.rescheduleCount || 0) >= 3) throw ApiError.conflict('This request has already been rescheduled the maximum number of times');

  const newStart = combineDateTime(date, time);
  const now = new Date();
  if (Number.isNaN(newStart.getTime()) || newStart < addMinutes(now, -10)) throw ApiError.badRequest('Please choose a future date and time');
  if (newStart > addMinutes(now, 60 * 24 * 60)) throw ApiError.badRequest('Please choose a date within the next 60 days');

  const settings = await getSettings();
  const technicianId = request.technicianId;
  let keep = false;
  if (technicianId) {
    const check = await assignmentService.checkTechnicianFreeAt(technicianId, request, newStart, settings);
    keep = check.ok;
  }

  const set = {
    preferredDate: startOfBusinessDay(date),
    preferredTime: time,
    scheduledAt: newStart,
    'assignment.nextAvailableSlot': null,
    'assignment.needsAdmin': false,
  };
  const updated = await ServiceRequest.findOneAndUpdate(
    { _id: request._id, status: { $in: CUSTOMER_CANCELLABLE_STATUSES } },
    {
      $set: set,
      $inc: { rescheduleCount: 1 },
      $push: { statusHistory: { status: request.status, at: now, by: user._id, byRole: 'CUSTOMER', note: `Rescheduled to ${date} ${time}` } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('The request changed state - please refresh and try again');

  let reassigned = false;
  if (technicianId && keep) {
    const tech = await Technician.findById(technicianId);
    if (tech) {
      await notify(tech.userId, {
        title: 'Customer rescheduled',
        message: `Request #${updated.requestNumber} moved to ${date} at ${time}.`,
        type: 'RESCHEDULED',
        data: { requestId: updated._id.toString(), requestNumber: updated.requestNumber, link: `/technician/jobs/${updated._id}` },
      });
    }
  } else if (technicianId) {
    // Technician cannot make the new slot: release and let the engine find someone who can.
    const tech = await Technician.findById(technicianId);
    const out = await assignmentService.releaseTechnician(updated._id, technicianId, {
      outcome: 'RESCHEDULED',
      reason: 'Customer rescheduled and the technician is not free at the new time',
      allowedStatuses: ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'],
    });
    reassigned = Boolean(out.reassigned);
    if (tech) {
      await notify(tech.userId, {
        title: 'Customer rescheduled',
        message: `Request #${updated.requestNumber} was rescheduled to a time you are not free; it has been reassigned.`,
        type: 'RESCHEDULED',
        data: { requestNumber: updated.requestNumber },
      });
      await technicianService.syncTechnicianState(tech._id);
    }
  } else {
    await assignmentService.processQueue();
  }

  const fresh = await ServiceRequest.findById(updated._id);
  broadcastRequestUpdate(fresh);
  return { request: fresh, technicianKept: keep, reassigned };
}

/* ------------------------------------------------------------------ */
/*  Technician actions                                                  */
/* ------------------------------------------------------------------ */

async function technicianAccept(requestId, technician, user) {
  const now = new Date();
  const request = await ServiceRequest.findOneAndUpdate(
    { _id: requestId, technicianId: technician._id, status: 'ASSIGNED' },
    {
      $set: { status: 'ACCEPTED', acceptedAt: now, 'assignment.expiresAt': null },
      $push: { statusHistory: { status: 'ACCEPTED', at: now, by: user._id, byRole: 'TECHNICIAN', note: 'Technician accepted' } },
    },
    { new: true }
  );
  if (!request) throw ApiError.conflict('This request is no longer waiting for your response (it may have expired or been reassigned)');

  await ServiceRequest.updateOne(
    { _id: request._id },
    { $set: { 'assignment.attempts.$[a].outcome': 'ACCEPTED', 'assignment.attempts.$[a].resolvedAt': now } },
    { arrayFilters: [{ 'a.technicianId': technician._id, 'a.outcome': 'PENDING' }] }
  );
  await technicianService.syncTechnicianState(technician._id);
  await notify(request.customerId, {
    title: 'Technician accepted',
    message: `${technician.name} accepted request #${request.requestNumber} and will be with you at the scheduled time.`,
    type: 'TECHNICIAN_ACCEPTED',
    data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/customer/request/${request._id}` },
  });
  broadcastRequestUpdate(request, user._id);
  return request;
}

const TRANSITION_MESSAGES = {
  ON_THE_WAY: ['Technician on the way', 'is on the way to your location.', 'TECHNICIAN_ON_THE_WAY'],
  ARRIVED: ['Technician arrived', 'has arrived at your location.', 'TECHNICIAN_ARRIVED'],
  SERVICE_STARTED: ['Service started', 'has started the service.', 'SERVICE_STARTED'],
  COMPLETED: ['Service completed', 'has completed the service. Please review the bill and pay.', 'SERVICE_COMPLETED'],
};

async function technicianTransition(requestId, technician, user, { status, finalAmount, billNote }) {
  const current = await ServiceRequest.findOne({ _id: requestId, technicianId: technician._id });
  if (!current) throw ApiError.notFound('Job not found');
  const expected = TECHNICIAN_TRANSITIONS[current.status];
  if (!expected) throw ApiError.conflict(`A job in status ${current.status} cannot be updated`);
  if (status !== expected) throw ApiError.conflict(`Next valid status is ${expected}, not ${status}`);

  const now = new Date();
  const set = { status };
  if (status === 'SERVICE_STARTED') set.startedAt = now;
  if (status === 'COMPLETED') {
    set.completedAt = now;
    set.finalAmount = finalAmount !== undefined ? finalAmount : current.price;
    set.billNote = billNote || '';
    set.paymentStatus = 'PENDING';
  }

  const request = await ServiceRequest.findOneAndUpdate(
    { _id: current._id, technicianId: technician._id, status: current.status },
    { $set: set, $push: { statusHistory: { status, at: now, by: user._id, byRole: 'TECHNICIAN', note: billNote || undefined } } },
    { new: true }
  );
  if (!request) throw ApiError.conflict('The job changed state - please refresh');

  if (status === 'ARRIVED') {
    // Technician reached the customer: his current working location becomes the customer's location
    // (e.g. Garia). The assignment engine ranks technicians by this location, so a nearby request that
    // comes in while he is still servicing is matched against his updated position.
    const loc = request.location || {};
    if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
      await Technician.updateOne(
        { _id: technician._id },
        {
          $set: {
            'location.latitude': loc.latitude,
            'location.longitude': loc.longitude,
            'location.address': loc.address || '',
            liveLocation: { latitude: loc.latitude, longitude: loc.longitude, updatedAt: now },
          },
        }
      );
    }
  }
  if (status === 'COMPLETED') {
    await Technician.updateOne({ _id: technician._id }, { $inc: { completedJobs: 1 } });
    await paymentService.createBill(request, request.finalAmount);
  }
  await technicianService.syncTechnicianState(technician._id);
  if (status === 'COMPLETED') assignmentService.processQueue().catch(() => {});

  const [title, text, type] = TRANSITION_MESSAGES[status];
  await notify(request.customerId, {
    title,
    message: `${technician.name} ${text} (Request #${request.requestNumber})`,
    type,
    data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: status === 'COMPLETED' ? `/customer/payment?request=${request._id}` : `/customer/request/${request._id}` },
  });
  broadcastRequestUpdate(request, user._id);
  return request;
}

module.exports = {
  createRequest,
  serializeForCustomer,
  serializeForTechnician,
  cancelRequest,
  rescheduleRequest,
  technicianAccept,
  technicianTransition,
  buildTimeline,
  canCustomerCancel,
  ACTIVE_JOB_STATUSES,
};
