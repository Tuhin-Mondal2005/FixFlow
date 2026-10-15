'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const EarningsLedger = require('../models/EarningsLedger');
const AuditLog = require('../models/AuditLog');
const SupportTicket = require('../models/SupportTicket');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/mask');
const { round2 } = require('../utils/geo');
const { startOfBusinessDay, addMinutes } = require('../utils/time');
const env = require('../config/env');
const { ACTIVE_JOB_STATUSES, COMMITTED_JOB_STATUSES } = require('../config/constants');
const documentService = require('../services/documentService');
const { decryptText } = require('../utils/crypto');
const technicianService = require('../services/technicianService');
const requestService = require('../services/requestService');
const assignmentService = require('../services/assignmentService');
const dispatchService = require('../services/dispatchService');
const paymentService = require('../services/paymentService');
const { getSettings, updateSettings } = require('../services/settingsService');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const TZ = env.tzOffset;

/* ================================================================== */
/*  Dashboard (Section 35)                                              */
/* ================================================================== */

exports.dashboard = asyncHandler(async (_req, res) => {
  const open = ['SUBMITTED', ...ACTIVE_JOB_STATUSES];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = addMinutes(new Date(), -30 * 24 * 60);

  const [
    total, pending, assigned, activeJobs, completed, cancelled, emergency,
    techTotal, techAvailable, techBusy, pendingVerification, avgRating,
    byCategory, workload, monthly, revenueByDay, needsAttention, openTickets,
  ] = await Promise.all([
    ServiceRequest.countDocuments(),
    ServiceRequest.countDocuments({ status: 'SUBMITTED' }),
    ServiceRequest.countDocuments({ status: 'ASSIGNED' }),
    ServiceRequest.countDocuments({ status: { $in: COMMITTED_JOB_STATUSES } }),
    ServiceRequest.countDocuments({ status: 'COMPLETED' }),
    ServiceRequest.countDocuments({ status: 'CANCELLED' }),
    ServiceRequest.countDocuments({ urgency: 'HIGH', status: { $in: open } }),
    Technician.countDocuments({ verificationStatus: 'APPROVED', deletedAt: null }),
    Technician.countDocuments({ verificationStatus: 'APPROVED', isActive: true, deletedAt: null, availabilityStatus: 'AVAILABLE' }),
    Technician.countDocuments({ verificationStatus: 'APPROVED', isActive: true, deletedAt: null, availabilityStatus: 'BUSY' }),
    Technician.countDocuments({ verificationStatus: 'PENDING', deletedAt: null }),
    Rating.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    ServiceRequest.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ServiceRequest.aggregate([
      { $match: { status: { $in: ACTIVE_JOB_STATUSES }, technicianId: { $ne: null } } },
      { $group: { _id: '$technicianId', jobs: { $sum: 1 } } },
      { $lookup: { from: 'technicians', localField: '_id', foreignField: '_id', as: 't' } },
      { $unwind: '$t' },
      { $project: { _id: 0, name: '$t.name', jobs: 1 } },
      { $sort: { jobs: -1 } },
      { $limit: 10 },
    ]),
    ServiceRequest.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { status: 'PAID', paidAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TZ } }, revenue: { $sum: '$amount' }, commission: { $sum: '$commission' } } },
      { $sort: { _id: 1 } },
    ]),
    ServiceRequest.find({ status: 'SUBMITTED', 'assignment.needsAdmin': true }).sort({ priority: -1, createdAt: 1 }).limit(8).select('requestNumber serviceName urgency createdAt assignment.nextAvailableSlot').lean(),
    SupportTicket.countDocuments({ status: { $in: ['OPEN', 'IN_REVIEW'] } }),
  ]);

  const totals = await Payment.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, revenue: { $sum: '$amount' }, commission: { $sum: '$commission' } } }]);

  res.json({
    success: true,
    stats: {
      totalRequests: total,
      pendingRequests: pending,
      assignedAwaitingResponse: assigned,
      completedRequests: completed,
      cancelledRequests: cancelled,
      activeJobs,
      emergencyRequests: emergency,
      totalTechnicians: techTotal,
      availableTechnicians: techAvailable,
      busyTechnicians: techBusy,
      pendingVerification,
      averageRating: round2(avgRating[0] ? avgRating[0].avg : 0),
      reviewCount: avgRating[0] ? avgRating[0].count : 0,
      totalRevenue: round2(totals[0] ? totals[0].revenue : 0),
      totalCommission: round2(totals[0] ? totals[0].commission : 0),
      openSupportTickets: openTickets,
    },
    charts: {
      requestsByCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
      completedVsCancelled: [{ name: 'Completed', value: completed }, { name: 'Cancelled', value: cancelled }],
      technicianWorkload: workload,
      revenueByDay: revenueByDay.map((d) => ({ date: d._id, revenue: round2(d.revenue), commission: round2(d.commission) })),
      monthlyBookings: monthly.map((m) => ({ month: m._id, count: m.count })),
    },
    needsAttention,
  });
});

/* ================================================================== */
/*  Technicians (Sections 36, 37)                                       */
/* ================================================================== */

exports.listTechnicians = asyncHandler(async (req, res) => {
  const { q, verificationStatus, availabilityStatus, skill, isActive, deleted, page, limit } = req.query;
  // deleted=true lists removed technicians (their Aadhaar and certificate copies are kept)
  const filter = { deletedAt: deleted ? { $ne: null } : null };
  if (isActive !== undefined) filter.isActive = isActive;
  if (verificationStatus) filter.verificationStatus = verificationStatus;
  if (availabilityStatus) filter.availabilityStatus = availabilityStatus;
  if (skill) filter.skills = skill;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { 'location.address': rx }];
  }
  const [rows, total] = await Promise.all([
    Technician.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Technician.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: rows.map((t) => t.userId) } }).select('email');
  const emailBy = new Map(users.map((u) => [u._id.toString(), u.email]));
  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    technicians: rows.map((t) => ({ ...technicianService.adminTechnicianView(t), email: emailBy.get(t.userId.toString()) })),
  });
});

exports.getTechnician = asyncHandler(async (req, res) => {
  // removed technicians stay viewable: their records are kept for future reference
  const tech = await Technician.findById(req.params.id);
  if (!tech) throw ApiError.notFound('Technician not found');
  const [user, recent, ratings, stats] = await Promise.all([
    User.findById(tech.userId).select('email createdAt isActive'),
    ServiceRequest.find({ technicianId: tech._id }).sort({ createdAt: -1 }).limit(10).select('requestNumber serviceName status urgency scheduledAt finalAmount').lean(),
    Rating.find({ technicianId: tech._id }).sort({ createdAt: -1 }).limit(10).populate('customerId', 'name').lean(),
    ServiceRequest.aggregate([{ $match: { technicianId: tech._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    technician: { ...technicianService.adminTechnicianView(tech), email: user && user.email, accountCreatedAt: user && user.createdAt },
    recentJobs: recent,
    ratings: ratings.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt, customer: r.customerId && r.customerId.name })),
    jobStats: Object.fromEntries(stats.map((s) => [s._id, s.count])),
  });
});

/** GET /api/admin/technicians/:id/documents/:kind/:index - decrypts and streams a private document. ADMIN ONLY. */
exports.viewDocument = asyncHandler(async (req, res) => {
  const tech = await Technician.findById(req.params.id); // removed technicians' documents are kept and stay viewable
  if (!tech) throw ApiError.notFound('Technician not found');
  const { kind } = req.params;
  const index = Number(req.params.index);
  const doc = kind === 'aadhaar' ? tech.aadhaarDocument : kind === 'qualification' ? tech.qualificationDocuments[index] : null;
  if (!doc) throw ApiError.notFound('Document not found');
  let buffer;
  try {
    buffer = await documentService.readPrivateDocument(doc);
  } catch {
    throw ApiError.notFound('Document file is missing or unreadable');
  }
  await audit(req, 'DOCUMENT_VIEWED', 'TECHNICIAN', tech._id, `Viewed ${kind} document of ${tech.name}`, { kind, index });
  res.set({
    'Content-Type': doc.mimeType,
    'Content-Length': buffer.length,
    'Content-Disposition': `inline; filename="${kind}-${tech._id}${doc.mimeType === 'application/pdf' ? '.pdf' : doc.mimeType === 'image/png' ? '.png' : '.jpg'}"`,
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(buffer);
});

exports.approveTechnician = asyncHandler(async (req, res) => {
  const tech = await Technician.findOne({ _id: req.params.id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician not found');
  if (tech.verificationStatus === 'APPROVED') throw ApiError.conflict('Technician is already approved');
  if (!tech.aadhaarDocument || !tech.qualificationDocuments.length) throw ApiError.badRequest('Required documents are missing');
  tech.verificationStatus = 'APPROVED';
  tech.rejectionReason = '';
  tech.isActive = true; // PENDING -> ACTIVE
  tech.verifiedAt = new Date();
  tech.verifiedBy = req.user._id;
  if (tech.availabilityStatus === 'OFFLINE') tech.availabilityStatus = 'AVAILABLE';
  await tech.save();
  await notify(tech.userId, { title: 'Application approved 🎉', message: 'You are now verified and can receive jobs. Log in to set your availability.', type: 'TECHNICIAN_APPROVED', data: { link: '/technician/dashboard' } });
  await audit(req, 'TECHNICIAN_APPROVED', 'TECHNICIAN', tech._id, `Approved technician ${tech.name}`);
  assignmentService.processQueue().catch(() => {});
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech) });
});

exports.rejectTechnician = asyncHandler(async (req, res) => {
  const tech = await Technician.findOne({ _id: req.params.id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician not found');
  if (tech.verificationStatus === 'REJECTED') throw ApiError.conflict('Technician is already rejected');
  const wasApproved = tech.verificationStatus === 'APPROVED';
  tech.verificationStatus = 'REJECTED';
  tech.rejectionReason = req.body.reason;
  tech.isActive = false;
  tech.availabilityStatus = 'OFFLINE';
  await tech.save();
  if (wasApproved) await technicianService.releaseOpenJobs(tech, { outcome: 'DEACTIVATED', reason: 'technician verification revoked', includeAccepted: true });
  await notify(tech.userId, { title: 'Application rejected', message: `Reason: ${req.body.reason}`, type: 'TECHNICIAN_REJECTED' });
  await audit(req, 'TECHNICIAN_REJECTED', 'TECHNICIAN', tech._id, `Rejected technician ${tech.name}`, { reason: req.body.reason });
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech) });
});

async function setActive(req, res, active) {
  const tech = await Technician.findOne({ _id: req.params.id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician not found');
  if (tech.verificationStatus !== 'APPROVED') throw ApiError.badRequest('Only approved technicians can be activated or deactivated');
  if (!active) {
    const started = await ServiceRequest.countDocuments({ technicianId: tech._id, status: 'SERVICE_STARTED' });
    if (started) throw ApiError.conflict('This technician is in the middle of a job. Deactivate after it is completed.');
  }
  tech.isActive = active;
  if (!active) tech.availabilityStatus = 'OFFLINE';
  else if (tech.availabilityStatus === 'OFFLINE') tech.availabilityStatus = 'AVAILABLE';
  await tech.save();
  if (!active) await technicianService.releaseOpenJobs(tech, { outcome: 'DEACTIVATED', reason: 'technician was deactivated', includeAccepted: true });
  else assignmentService.processQueue().catch(() => {});
  await notify(tech.userId, { title: active ? 'Account activated' : 'Account deactivated', message: active ? 'You can receive jobs again.' : 'An administrator deactivated your technician account.', type: 'ACCOUNT_STATUS' });
  await audit(req, active ? 'TECHNICIAN_ACTIVATED' : 'TECHNICIAN_DEACTIVATED', 'TECHNICIAN', tech._id, `${active ? 'Activated' : 'Deactivated'} technician ${tech.name}`);
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech) });
}
exports.activateTechnician = asyncHandler((req, res) => setActive(req, res, true));
exports.deactivateTechnician = asyncHandler((req, res) => setActive(req, res, false));

/** POST /api/admin/technicians - admin adds a technician directly (pre-verified) */
exports.createTechnician = asyncHandler(async (req, res) => {
  const d = req.body;
  if (await User.exists({ email: d.email })) throw ApiError.conflict('An account with this email already exists');
  const found = await Service.countDocuments({ slug: { $in: d.skills }, isActive: true });
  if (found !== new Set(d.skills).size) throw ApiError.badRequest('One or more skills are not valid services');
  const settings = await getSettings();
  const user = await User.create({ name: d.name, email: d.email, phone: d.phone, passwordHash: await bcrypt.hash(d.password, 12), role: 'TECHNICIAN', address: { line: d.address, latitude: d.latitude, longitude: d.longitude } });
  const tech = await Technician.create({
    userId: user._id,
    name: d.name,
    phone: d.phone,
    location: { address: d.address, latitude: d.latitude, longitude: d.longitude },
    serviceRadiusKm: d.serviceRadiusKm || settings.defaultServiceRadiusKm,
    skills: [...new Set(d.skills)],
    experience: d.experience,
    certifications: d.certifications,
    verificationStatus: 'APPROVED',
    isActive: true,
    verifiedAt: new Date(),
    verifiedBy: req.user._id,
    availabilityStatus: 'AVAILABLE',
  });
  await audit(req, 'TECHNICIAN_CREATED', 'TECHNICIAN', tech._id, `Created technician ${tech.name}`);
  res.status(201).json({ success: true, technician: technicianService.adminTechnicianView(tech) });
});

exports.updateTechnician = asyncHandler(async (req, res) => {
  const tech = await Technician.findOne({ _id: req.params.id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician not found');
  const d = req.body;
  if (d.skills) {
    const found = await Service.countDocuments({ slug: { $in: d.skills } });
    if (found !== new Set(d.skills).size) throw ApiError.badRequest('One or more skills are not valid services');
    tech.skills = [...new Set(d.skills)];
  }
  if (d.name) tech.name = d.name;
  if (d.phone) tech.phone = d.phone;
  if (d.address) tech.location.address = d.address;
  if (d.latitude !== undefined) tech.location.latitude = d.latitude;
  if (d.longitude !== undefined) tech.location.longitude = d.longitude;
  if (d.experience !== undefined) tech.experience = d.experience;
  if (d.certifications) tech.certifications = d.certifications;
  if (d.serviceRadiusKm !== undefined) tech.serviceRadiusKm = d.serviceRadiusKm;
  if (d.workingHours) tech.workingHours = d.workingHours;
  await tech.save();
  const userPatch = {};
  if (d.name) userPatch.name = d.name;
  if (d.phone) userPatch.phone = d.phone;
  if (d.email) userPatch.email = d.email;
  if (Object.keys(userPatch).length) await User.updateOne({ _id: tech.userId }, { $set: userPatch });
  await audit(req, 'TECHNICIAN_UPDATED', 'TECHNICIAN', tech._id, `Updated technician ${tech.name}`, { fields: Object.keys(d) });
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech) });
});

/** DELETE - soft delete: history stays intact, Aadhaar and certificate copies are KEPT for future reference, login disabled */
exports.deleteTechnician = asyncHandler(async (req, res) => {
  const tech = await Technician.findOne({ _id: req.params.id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician not found');
  const blocking = await ServiceRequest.countDocuments({ technicianId: tech._id, status: { $in: ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'] } });
  if (blocking) throw ApiError.conflict('This technician has a job in progress and cannot be deleted right now');
  await technicianService.releaseOpenJobs(tech, { outcome: 'DEACTIVATED', reason: 'technician was removed', includeAccepted: true });
  // Aadhaar document, certificates and the Aadhaar number are deliberately NOT removed.
  await documentService.deletePublicPhoto(tech.profilePhoto);
  tech.deletedAt = new Date();
  tech.isActive = false;
  tech.availabilityStatus = 'OFFLINE';
  tech.profilePhoto = '';
  await tech.save();
  await User.updateOne({ _id: tech.userId }, { $set: { isActive: false }, $inc: { tokenVersion: 1 } });
  await audit(req, 'TECHNICIAN_DELETED', 'TECHNICIAN', tech._id, `Deleted technician ${tech.name}`);
  res.json({ success: true, message: 'Technician removed' });
});

/* ================================================================== */
/*  Requests (Section 38)                                               */
/* ================================================================== */

exports.listRequests = asyncHandler(async (req, res) => {
  const { q, status, urgency, serviceId, technicianId, from, to, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = { $in: status.split(',').map((s) => s.trim().toUpperCase()) };
  if (urgency) filter.urgency = urgency;
  if (serviceId) filter.serviceId = serviceId;
  if (technicianId) filter.technicianId = technicianId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = startOfBusinessDay(from);
    if (to) filter.scheduledAt.$lt = new Date(startOfBusinessDay(to).getTime() + 86400000);
  }
  if (q) {
    const num = Number(q.replace('#', ''));
    const rx = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ role: 'CUSTOMER', $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(50);
    filter.$or = [{ customerId: { $in: users.map((u) => u._id) } }, { serviceName: rx }, { 'location.address': rx }];
    if (!Number.isNaN(num)) filter.$or.push({ requestNumber: num });
  }
  const [rows, total] = await Promise.all([
    ServiceRequest.find(filter).sort({ priority: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('customerId', 'name phone').populate('technicianId', 'name').lean(),
    ServiceRequest.countDocuments(filter),
  ]);
  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    requests: rows.map((r) => ({
      _id: r._id,
      requestNumber: r.requestNumber,
      serviceName: r.serviceName,
      category: r.category,
      urgency: r.urgency,
      priority: r.priority,
      status: r.status,
      scheduledAt: r.scheduledAt,
      preferredTime: r.preferredTime,
      address: r.location.address,
      price: r.price,
      finalAmount: r.finalAmount,
      paymentStatus: r.paymentStatus,
      customer: r.customerId ? { name: r.customerId.name, phone: r.customerId.phone } : null,
      technician: r.technicianId ? { _id: r.technicianId._id, name: r.technicianId.name } : null,
      needsAdmin: !!(r.assignment && r.assignment.needsAdmin),
      createdAt: r.createdAt,
    })),
  });
});

exports.getRequest = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id).populate('customerId', 'name email phone').lean();
  if (!request) throw ApiError.notFound('Request not found');
  const [tech, payment, rating, ticket] = await Promise.all([
    request.technicianId ? Technician.findById(request.technicianId).select('name phone rating ratingCount experience completedJobs availabilityStatus currentJobs profilePhoto location liveLocation') : null,
    Payment.findOne({ requestId: request._id }).select('-gatewayOrderId'),
    Rating.findOne({ requestId: request._id }),
    SupportTicket.find({ requestId: request._id }).select('ticketNumber status subject'),
  ]);
  const timeline = requestService.buildTimeline(request);
  res.json({ success: true, request: { ...request, timeline, technician: tech, payment, rating, tickets: ticket } });
});

/** GET /api/admin/requests/:id/candidates - dry-run of the engine: scores + why others were filtered out */
exports.candidates = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound('Request not found');
  const service = await Service.findById(request.serviceId);
  const settings = await getSettings();
  const out = await assignmentService.rankTechnicians(request, service, settings, { excludeIds: [] });
  res.json({
    success: true,
    weights: settings.assignmentWeights,
    requestedStart: out.requestedStart,
    ranked: out.ranked,
    rejected: out.rejected,
    nextAvailableSlot: out.nextAvailableSlot,
  });
});

exports.assignRequest = asyncHandler(async (req, res) => {
  const out = await dispatchService.manualAssign(req.params.id, req.body.technicianId, req.user, { force: req.body.force });
  await audit(req, 'REQUEST_ASSIGNED', 'REQUEST', req.params.id, `Manually assigned request #${out.request.requestNumber} to ${out.technician.name}`, { warnings: out.warnings });
  res.json({ success: true, message: `Assigned to ${out.technician.name}`, warnings: out.warnings, request: await ServiceRequest.findById(req.params.id) });
});

exports.reassignRequest = asyncHandler(async (req, res) => {
  const { technicianId, force, reason } = req.body;
  let message;
  let requestNumber;
  if (technicianId) {
    const out = await dispatchService.manualAssign(req.params.id, technicianId, req.user, { force, reason });
    requestNumber = out.request.requestNumber;
    message = `Reassigned to ${out.technician.name}`;
    await audit(req, 'REQUEST_REASSIGNED', 'REQUEST', req.params.id, `Reassigned request #${requestNumber} to ${out.technician.name}`, { reason, warnings: out.warnings });
  } else {
    const out = await dispatchService.autoAssignNow(req.params.id, req.user);
    requestNumber = out.request.requestNumber;
    message = out.assigned ? 'The engine picked the next best technician' : `No eligible technician right now (${out.reason || 'none'})`;
    await audit(req, 'REQUEST_REASSIGNED', 'REQUEST', req.params.id, `Auto-reassigned request #${requestNumber}`, { result: out.reason || 'ASSIGNED' });
  }
  res.json({ success: true, message, request: await ServiceRequest.findById(req.params.id) });
});

exports.autoAssign = asyncHandler(async (req, res) => {
  const out = await dispatchService.autoAssignNow(req.params.id, req.user, { resetExclusions: true });
  await audit(req, 'REQUEST_AUTO_ASSIGNED', 'REQUEST', req.params.id, `Ran automatic assignment for request #${out.request.requestNumber}`, { result: out.reason || 'ASSIGNED' });
  res.json({ success: true, assigned: out.assigned, message: out.assigned ? 'Technician assigned automatically' : `No eligible technician found (${out.reason})`, nextAvailableSlot: out.nextAvailableSlot, request: out.request });
});

exports.cancelRequest = asyncHandler(async (req, res) => {
  const request = await requestService.cancelRequest(req.params.id, req.user, req.body.reason);
  await audit(req, 'REQUEST_CANCELLED', 'REQUEST', request._id, `Cancelled request #${request.requestNumber}`, { reason: req.body.reason });
  res.json({ success: true, request });
});

/* ================================================================== */
/*  Services & pricing                                                  */
/* ================================================================== */

exports.listServices = asyncHandler(async (_req, res) => {
  res.json({ success: true, services: await Service.find().sort({ category: 1, name: 1 }).lean() });
});

exports.createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  await audit(req, 'SERVICE_CREATED', 'SERVICE', service._id, `Created service ${service.name}`);
  res.status(201).json({ success: true, service });
});

exports.updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');
  const before = { startingPrice: service.startingPrice, isActive: service.isActive, commissionRate: service.commissionRate };
  Object.assign(service, req.body);
  await service.save();
  await audit(req, 'SERVICE_UPDATED', 'SERVICE', service._id, `Updated service ${service.name}`, { before, fields: Object.keys(req.body) });
  res.json({ success: true, service });
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');
  const used = await ServiceRequest.exists({ serviceId: service._id });
  if (used) {
    service.isActive = false; // keep history, just hide it
    await service.save();
    await audit(req, 'SERVICE_DEACTIVATED', 'SERVICE', service._id, `Deactivated service ${service.name} (has requests)`);
    return res.json({ success: true, message: 'Service has booking history, so it was deactivated instead of deleted.' });
  }
  await service.deleteOne();
  await audit(req, 'SERVICE_DELETED', 'SERVICE', service._id, `Deleted service ${service.name}`);
  res.json({ success: true, message: 'Service deleted' });
});

/* ================================================================== */
/*  Settings (assignment weights, commission, timeouts)                 */
/* ================================================================== */

exports.getSettings = asyncHandler(async (_req, res) => {
  const s = await getSettings({ fresh: true });
  const { _id, __v, ...rest } = s;
  res.json({ success: true, settings: rest });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const { before, after } = await updateSettings(req.body);
  await audit(req, 'SETTINGS_UPDATED', 'SETTINGS', 'global', 'Updated platform settings', { before: { weights: before.assignmentWeights, commission: before.commissionRates }, after: { weights: after.assignmentWeights, commission: after.commissionRates } });
  const { _id, __v, ...rest } = after;
  res.json({ success: true, settings: rest });
});

/* ================================================================== */
/*  Payments, commission and payouts                                    */
/* ================================================================== */

exports.listPayments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.method) filter.method = String(req.query.method).toUpperCase();
  const [rows, total, totals, pendingPayouts] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('requestId', 'requestNumber serviceName').populate('technicianId', 'name').populate('customerId', 'name').lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, revenue: { $sum: '$amount' }, commission: { $sum: '$commission' }, technicianEarnings: { $sum: '$technicianEarning' }, count: { $sum: 1 } } }]),
    EarningsLedger.aggregate([
      { $match: { entryType: 'EARNING', $or: [{ paymentMethod: 'ONLINE', payoutStatus: 'PENDING' }, { paymentMethod: 'CASH', commissionSettled: false, payoutStatus: 'IN_HAND' }] } },
      { $group: { _id: { technicianId: '$technicianId', method: '$paymentMethod' }, amount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'ONLINE'] }, '$netEarning', '$platformFee'] } }, jobs: { $sum: 1 } } },
      { $lookup: { from: 'technicians', localField: '_id.technicianId', foreignField: '_id', as: 't' } },
      { $unwind: '$t' },
      { $project: { _id: 0, technicianId: '$_id.technicianId', technician: '$t.name', method: '$_id.method', amount: 1, jobs: 1 } },
    ]),
  ]);
  const t = totals[0] || { revenue: 0, commission: 0, technicianEarnings: 0, count: 0 };
  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    totals: { revenue: round2(t.revenue), commission: round2(t.commission), technicianEarnings: round2(t.technicianEarnings), paidCount: t.count },
    payouts: pendingPayouts.map((p) => ({ ...p, amount: round2(p.amount), direction: p.method === 'ONLINE' ? 'PAY_TECHNICIAN' : 'COLLECT_COMMISSION' })),
    payments: rows.map((p) => ({
      _id: p._id,
      requestNumber: p.requestId && p.requestId.requestNumber,
      serviceName: p.requestId && p.requestId.serviceName,
      customer: p.customerId && p.customerId.name,
      technician: p.technicianId && p.technicianId.name,
      amount: p.amount,
      commissionRate: p.commissionRate,
      commission: p.commission,
      technicianEarning: p.technicianEarning,
      method: p.method,
      status: p.status,
      invoiceNumber: p.invoiceNumber,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
  });
});

exports.refundPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  const out = await paymentService.refundPayment(payment);
  await audit(req, 'PAYMENT_REFUNDED', 'PAYMENT', payment._id, `Refunded ₹${payment.amount}`);
  res.json({ success: true, payment: out });
});

/** POST /api/admin/payouts/:technicianId/settle - pay out online earnings + record cash commission collected */
exports.settlePayout = asyncHandler(async (req, res) => {
  const technicianId = req.params.technicianId;
  const now = new Date();
  const online = await EarningsLedger.updateMany({ technicianId, entryType: 'EARNING', paymentMethod: 'ONLINE', payoutStatus: 'PENDING' }, { $set: { payoutStatus: 'PAID_OUT', settledAt: now } });
  const cash = await EarningsLedger.updateMany({ technicianId, entryType: 'EARNING', paymentMethod: 'CASH', commissionSettled: false, payoutStatus: 'IN_HAND' }, { $set: { commissionSettled: true, settledAt: now } });
  await audit(req, 'PAYOUT_SETTLED', 'PAYMENT', technicianId, 'Settled technician payout / cash commission', { onlineRows: online.modifiedCount, cashRows: cash.modifiedCount });
  const tech = await Technician.findById(technicianId).select('userId');
  if (tech) await notify(tech.userId, { title: 'Payout settled', message: 'Your pending payout and commission balance were settled by the platform.', type: 'PAYOUT_SETTLED', data: { link: '/technician/earnings' } });
  res.json({ success: true, onlineRows: online.modifiedCount, cashRows: cash.modifiedCount });
});

/* ================================================================== */
/*  Audit log + support                                                 */
/* ================================================================== */

exports.auditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const filter = {};
  if (req.query.action) filter.action = String(req.query.action).toUpperCase();
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  res.json({ success: true, logs: rows, total, page, pages: Math.ceil(total / limit) });
});

exports.listTickets = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const rows = await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(100).populate('customerId', 'name email phone').lean();
  res.json({ success: true, tickets: rows });
});

exports.updateTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  ticket.status = req.body.status;
  ticket.adminNote = req.body.adminNote;
  if (['RESOLVED', 'REJECTED'].includes(req.body.status)) { ticket.resolvedBy = req.user._id; ticket.resolvedAt = new Date(); }
  await ticket.save();
  await notify(ticket.customerId, { title: `Support ticket #${ticket.ticketNumber} ${ticket.status.toLowerCase().replace('_', ' ')}`, message: ticket.adminNote || 'Your support request was updated.', type: 'SUPPORT_UPDATE', data: { link: '/customer/support' } });
  await audit(req, 'SUPPORT_UPDATED', 'SUPPORT', ticket._id, `Ticket #${ticket.ticketNumber} → ${ticket.status}`);
  res.json({ success: true, ticket });
});

/** GET /api/admin/technicians/:id/aadhaar - full 12-digit number. ADMIN ONLY, never cached, every reveal is audit-logged. */
exports.revealAadhaar = asyncHandler(async (req, res) => {
  const tech = await Technician.findById(req.params.id).select('+aadhaarNumberEncrypted name');
  if (!tech) throw ApiError.notFound('Technician not found');
  if (!tech.aadhaarNumberEncrypted) {
    throw ApiError.notFound('The full Aadhaar number was not captured for this application. Use the Aadhaar document instead.');
  }
  const aadhaarNumber = decryptText(tech.aadhaarNumberEncrypted);
  await audit(req, 'AADHAAR_REVEALED', 'TECHNICIAN', tech._id, `Revealed Aadhaar number of ${tech.name}`);
  res.set({ 'Cache-Control': 'no-store, private' });
  res.json({ success: true, aadhaarNumber });
});

/** GET /api/admin/reviews - every customer review plus the platform average (drill-down from the dashboard) */
exports.listReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const [rows, total, agg] = await Promise.all([
    Rating.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('customerId', 'name').populate('technicianId', 'name').populate('serviceId', 'name').populate('requestId', 'requestNumber').lean(),
    Rating.countDocuments(),
    Rating.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]),
  ]);
  res.json({
    success: true,
    total,
    page,
    pages: Math.ceil(total / limit),
    average: round2(agg[0] ? agg[0].avg : 0),
    reviews: rows.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      customer: r.customerId ? r.customerId.name : 'Customer',
      technician: r.technicianId ? r.technicianId.name : '—',
      technicianId: r.technicianId ? r.technicianId._id : null,
      service: r.serviceId ? r.serviceId.name : '',
      requestNumber: r.requestId ? r.requestId.requestNumber : null,
    })),
  });
});
