'use strict';

const ServiceRequest = require('../models/ServiceRequest');
const Technician = require('../models/Technician');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const Service = require('../models/Service');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const requestService = require('../services/requestService');
const technicianService = require('../services/technicianService');
const { notify } = require('../services/notificationService');
const { ACTIVE_JOB_STATUSES } = require('../config/constants');

const OPEN = ['SUBMITTED', ...ACTIVE_JOB_STATUSES];

/** POST /api/requests */
exports.create = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.user, req.body);
  res.status(201).json({ success: true, request: await requestService.serializeForCustomer(request) });
});

/** GET /api/requests/my?group=active|upcoming|completed|cancelled|all */
exports.mine = asyncHandler(async (req, res) => {
  const group = String(req.query.group || 'all');
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { customerId: req.user._id };
  if (group === 'active') filter.status = { $in: OPEN };
  else if (group === 'upcoming') { filter.status = { $in: ['SUBMITTED', 'ASSIGNED', 'ACCEPTED'] }; filter.scheduledAt = { $gte: new Date() }; }
  else if (group === 'completed') filter.status = 'COMPLETED';
  else if (group === 'cancelled') filter.status = 'CANCELLED';
  else if (group === 'history') filter.status = { $in: ['COMPLETED', 'CANCELLED'] };

  const [rows, total] = await Promise.all([
    ServiceRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ServiceRequest.countDocuments(filter),
  ]);
  const techIds = [...new Set(rows.filter((r) => r.technicianId).map((r) => r.technicianId.toString()))];
  const techs = await Technician.find({ _id: { $in: techIds } }).select('name profilePhoto rating');
  const techMap = new Map(techs.map((t) => [t._id.toString(), t]));
  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    requests: rows.map((r) => {
      const o = r.toObject();
      const t = o.technicianId && techMap.get(o.technicianId.toString());
      delete o.assignment;
      delete o.statusHistory;
      return { ...o, technician: t ? { name: t.name, profilePhoto: t.profilePhoto, rating: t.rating } : null, canCancel: requestService.canCustomerCancel(o) };
    }),
  });
});

/** GET /api/requests/summary - counters for the customer dashboard */
exports.summary = asyncHandler(async (req, res) => {
  const base = { customerId: req.user._id };
  const [active, upcoming, completed, cancelled, unpaid, paid] = await Promise.all([
    ServiceRequest.countDocuments({ ...base, status: { $in: OPEN } }),
    ServiceRequest.countDocuments({ ...base, status: { $in: ['SUBMITTED', 'ASSIGNED', 'ACCEPTED'] }, scheduledAt: { $gte: new Date() } }),
    ServiceRequest.countDocuments({ ...base, status: 'COMPLETED' }),
    ServiceRequest.countDocuments({ ...base, status: 'CANCELLED' }),
    Payment.countDocuments({ customerId: req.user._id, status: { $in: ['PENDING', 'FAILED'] } }),
    Payment.aggregate([{ $match: { customerId: req.user._id, status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  res.json({ success: true, summary: { active, upcoming, completed, cancelled, unpaidBills: unpaid, totalPaid: paid[0] ? paid[0].total : 0 } });
});

async function loadForViewer(req) {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Request not found');
  if (req.user.role === 'ADMIN') return { request, viewer: 'ADMIN' };
  if (req.user.role === 'CUSTOMER' && request.customerId.equals(req.user._id)) return { request, viewer: 'CUSTOMER' };
  if (req.user.role === 'TECHNICIAN' && request.technicianId) {
    const tech = await Technician.findOne({ userId: req.user._id });
    if (tech && tech._id.equals(request.technicianId)) return { request, viewer: 'TECHNICIAN', tech };
  }
  // Same response as "not found" so ids cannot be probed
  throw ApiError.notFound('Request not found');
}

/** GET /api/requests/:id (customer owner) */
exports.get = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findOne({ _id: req.params.id, customerId: req.user._id });
  if (!request) throw ApiError.notFound('Request not found');
  res.json({ success: true, request: await requestService.serializeForCustomer(request) });
});

/** PUT /api/requests/:id/cancel - rule enforced in requestService (atomic status filter) */
exports.cancel = asyncHandler(async (req, res) => {
  const request = await requestService.cancelRequest(req.params.id, req.user, req.body.reason);
  res.json({ success: true, message: 'Request cancelled', request: await requestService.serializeForCustomer(request) });
});

/** PUT /api/requests/:id/reschedule */
exports.reschedule = asyncHandler(async (req, res) => {
  const out = await requestService.rescheduleRequest(req.params.id, req.user, req.body.preferredDate, req.body.preferredTime);
  const msg = out.technicianKept
    ? 'Rescheduled. Your technician is available at the new time.'
    : out.reassigned
    ? 'Rescheduled. Your technician was not free, so we matched you with another one.'
    : 'Rescheduled. We are finding an available technician for the new time.';
  res.json({ success: true, message: msg, request: await requestService.serializeForCustomer(out.request) });
});

/** POST /api/requests/:id/rating */
exports.rate = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findOne({ _id: req.params.id, customerId: req.user._id });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'COMPLETED') throw ApiError.conflict('You can rate a technician once the service is completed');
  if (!request.technicianId) throw ApiError.conflict('No technician to rate');
  if (await Rating.exists({ requestId: request._id })) throw ApiError.conflict('You have already reviewed this service');

  const { rating, comment } = req.body;
  const review = await Rating.create({ requestId: request._id, customerId: req.user._id, technicianId: request.technicianId, serviceId: request.serviceId, rating, comment });
  await ServiceRequest.updateOne({ _id: request._id }, { $set: { isRated: true } });

  // Technician running average
  const tech = await technicianService.applyRatingToTechnician(request.technicianId, rating);
  // Service average (shown on the service cards)
  const svc = await Service.findById(request.serviceId);
  if (svc) {
    svc.ratingAvg = Math.round(((svc.ratingAvg * svc.ratingCount + rating) / (svc.ratingCount + 1)) * 100) / 100;
    svc.ratingCount += 1;
    await svc.save();
  }
  if (tech) {
    await notify(tech.userId, {
      title: 'New review',
      message: `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} for request #${request.requestNumber}${comment ? `: "${comment.slice(0, 80)}"` : ''}`,
      type: 'NEW_REVIEW',
      data: { requestNumber: request.requestNumber, link: '/technician/profile' },
    });
  }
  res.status(201).json({ success: true, message: 'Thank you for your feedback!', review });
});

/** GET /api/requests/ratings/mine - reviews written by the customer */
exports.myRatings = asyncHandler(async (req, res) => {
  const rows = await Rating.find({ customerId: req.user._id }).sort({ createdAt: -1 }).populate('requestId', 'requestNumber serviceName').populate('technicianId', 'name').lean();
  res.json({
    success: true,
    ratings: rows.map((r) => ({ _id: r._id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, requestNumber: r.requestId && r.requestId.requestNumber, serviceName: r.requestId && r.requestId.serviceName, technician: r.technicianId && r.technicianId.name })),
  });
});

/** GET /api/requests/:id/invoice - digital invoice (Section 66). Customer, assigned technician or admin. */
exports.invoice = asyncHandler(async (req, res) => {
  const { request } = await loadForViewer(req);
  const payment = await Payment.findOne({ requestId: request._id });
  if (!payment || payment.status === 'PENDING' || payment.status === 'FAILED') throw ApiError.conflict('The invoice is available once the payment is confirmed');
  const [customer, tech] = await Promise.all([User.findById(request.customerId).select('name email phone'), Technician.findById(request.technicianId).select('name phone')]);
  res.json({
    success: true,
    invoice: {
      invoiceNumber: payment.invoiceNumber,
      requestNumber: request.requestNumber,
      date: payment.paidAt || request.completedAt,
      serviceDate: request.completedAt || request.scheduledAt,
      service: request.serviceName,
      package: request.packageName,
      customer: { name: customer && customer.name, email: customer && customer.email, phone: customer && customer.phone, address: request.location.address },
      technician: tech ? { name: tech.name } : null,
      amount: payment.amount,
      platformFee: payment.commission,
      commissionRate: payment.commissionRate,
      technicianEarning: payment.technicianEarning,
      paymentMethod: payment.method,
      paymentStatus: payment.status,
      note: 'FixFlow is a service-only platform. Any spare part or replacement item is arranged and paid for separately by the customer.',
    },
  });
});

exports.loadForViewer = loadForViewer;
