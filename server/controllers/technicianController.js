'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const EarningsLedger = require('../models/EarningsLedger');
const Rating = require('../models/Rating');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { periodStarts } = require('../utils/time');
const { round2 } = require('../utils/geo');
const { ACTIVE_JOB_STATUSES, COMMITTED_JOB_STATUSES } = require('../config/constants');
const documentService = require('../services/documentService');
const { encryptText } = require('../utils/crypto');
const technicianService = require('../services/technicianService');
const requestService = require('../services/requestService');
const assignmentService = require('../services/assignmentService');
const { getSettings } = require('../services/settingsService');
const { notifyAdmins } = require('../services/notificationService');

/** Load the Technician document that belongs to the logged-in user. */
async function currentTechnician(req) {
  const tech = await Technician.findOne({ userId: req.user._id, deletedAt: null });
  if (!tech) throw ApiError.notFound('Technician profile not found');
  return tech;
}
exports.currentTechnician = currentTechnician;

async function assertValidSkills(skills) {
  const found = await Service.countDocuments({ slug: { $in: skills }, isActive: true });
  if (found !== new Set(skills).size) throw ApiError.badRequest('One or more selected skills are not valid services');
}

/** POST /api/technicians/register (multipart) - creates a PENDING application. */
exports.register = asyncHandler(async (req, res) => {
  const files = req.files || {};
  const aadhaar = files.aadhaar && files.aadhaar[0];
  const qualifications = files.qualification || [];
  const photo = files.photo && files.photo[0];
  if (!aadhaar) throw ApiError.badRequest('Aadhaar document is required');
  if (!qualifications.length) throw ApiError.badRequest('At least one qualification / certificate document is required');

  const d = req.body;
  if (await User.exists({ email: d.email })) throw ApiError.conflict('An account with this email already exists');
  await assertValidSkills(d.skills);

  const stored = { aadhaar: null, qualifications: [], photo: '' };
  let user = null;
  try {
    // Validate content + store encrypted in PRIVATE storage
    stored.aadhaar = await documentService.storePrivateDocument(aadhaar);
    for (const q of qualifications) stored.qualifications.push(await documentService.storePrivateDocument(q));
    if (photo) stored.photo = await documentService.storeProfilePhoto(photo);

    user = await User.create({
      name: d.name,
      email: d.email,
      phone: d.phone,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: 'TECHNICIAN',
      address: { line: d.address, latitude: d.latitude, longitude: d.longitude },
    });

    const settings = await getSettings();
    await Technician.create({
      userId: user._id,
      name: d.name,
      phone: d.phone,
      profilePhoto: stored.photo,
      location: { address: d.address, latitude: d.latitude, longitude: d.longitude },
      serviceRadiusKm: d.serviceRadiusKm || settings.defaultServiceRadiusKm,
      skills: [...new Set(d.skills)],
      experience: d.experience,
      certifications: d.certifications,
      aadhaarDocument: stored.aadhaar,
      aadhaarLast4: d.aadhaarNumber.slice(-4),
      aadhaarNumberEncrypted: encryptText(d.aadhaarNumber),
      qualificationDocuments: stored.qualifications,
      verificationStatus: 'PENDING',
      isActive: false,
      availabilityStatus: 'OFFLINE',
    });
  } catch (err) {
    // roll back anything already written
    if (user) await User.deleteOne({ _id: user._id });
    await documentService.deletePrivateDocument(stored.aadhaar);
    for (const q of stored.qualifications) await documentService.deletePrivateDocument(q);
    await documentService.deletePublicPhoto(stored.photo);
    throw err;
  }

  await notifyAdmins({
    title: 'New technician application',
    message: `${d.name} applied as a technician and is waiting for verification.`,
    type: 'TECHNICIAN_APPLICATION',
    data: { link: '/admin/technicians/pending' },
  });
  res.status(201).json({ success: true, message: 'Application submitted. An administrator will review your documents. You can log in once you are approved.' });
});

/** GET /api/technicians/profile */
exports.getProfile = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech), user: req.user.toJSON() });
});

/** PUT /api/technicians/profile (multipart allowed - optional new photo) */
exports.updateProfile = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const d = req.body;
  if (d.skills) await assertValidSkills(d.skills);

  if (d.name) tech.name = d.name;
  if (d.phone) tech.phone = d.phone;
  if (d.address) tech.location.address = d.address;
  if (d.latitude !== undefined) tech.location.latitude = d.latitude;
  if (d.longitude !== undefined) tech.location.longitude = d.longitude;
  if (d.skills) tech.skills = [...new Set(d.skills)];
  if (d.experience !== undefined) tech.experience = d.experience;
  if (d.certifications) tech.certifications = d.certifications;
  if (d.serviceRadiusKm !== undefined) tech.serviceRadiusKm = d.serviceRadiusKm;
  if (d.workingHours) tech.workingHours = d.workingHours;

  const photo = req.files && req.files.photo && req.files.photo[0];
  if (photo) {
    const old = tech.profilePhoto;
    tech.profilePhoto = await documentService.storeProfilePhoto(photo);
    await documentService.deletePublicPhoto(old);
  }
  await tech.save();

  if (d.name || d.phone) {
    if (d.name) req.user.name = d.name;
    if (d.phone) req.user.phone = d.phone;
    await req.user.save();
  }
  res.json({ success: true, technician: technicianService.adminTechnicianView(tech) });
});

/** PUT /api/technicians/availability  (Section 8) */
exports.updateAvailability = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const { availabilityStatus, availableFrom, workingHours } = req.body;
  // a deactivated technician (old login token still valid) must not be able to go available again
  if (!tech.isActive) throw ApiError.forbidden('Your account is deactivated. Contact the administrator to reactivate it.');

  if (availabilityStatus === 'BUSY') {
    if (!availableFrom) throw ApiError.badRequest('Tell us when you will be available again ("Available after")');
    if (new Date(availableFrom) <= new Date()) throw ApiError.badRequest('"Available after" must be in the future');
  }

  if (['OFFLINE', 'ON_LEAVE'].includes(availabilityStatus)) {
    const committed = await ServiceRequest.countDocuments({ technicianId: tech._id, status: { $in: COMMITTED_JOB_STATUSES } });
    if (committed > 0) throw ApiError.conflict('You have accepted jobs. Complete them (or ask the dispatcher to reassign) before going offline.');
  }

  tech.availabilityStatus = availabilityStatus;
  tech.availableFrom = availabilityStatus === 'BUSY' ? new Date(availableFrom) : null;
  if (workingHours) tech.workingHours = workingHours;
  await tech.save();

  if (['OFFLINE', 'ON_LEAVE'].includes(availabilityStatus)) {
    // offers they have not answered yet go to the next best technician
    await technicianService.releaseOpenJobs(tech, { outcome: 'REASSIGNED', reason: `technician is ${availabilityStatus.toLowerCase().replace('_', ' ')}` });
  } else if (availabilityStatus === 'AVAILABLE') {
    assignmentService.processQueue().catch(() => {}); // someone may be waiting for a free technician
  }
  const fresh = await technicianService.syncTechnicianState(tech._id);
  res.json({ success: true, technician: fresh });
});

/** GET /api/technicians/dashboard */
exports.dashboard = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const { dayStart } = periodStarts();
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [pending, active, todays, completedToday, todayEarn, nextJobs] = await Promise.all([
    ServiceRequest.find({ technicianId: tech._id, status: 'ASSIGNED' }).sort({ priority: -1, createdAt: 1 }),
    ServiceRequest.find({ technicianId: tech._id, status: { $in: COMMITTED_JOB_STATUSES } }).sort({ scheduledAt: 1 }),
    ServiceRequest.countDocuments({ technicianId: tech._id, status: { $in: ACTIVE_JOB_STATUSES }, scheduledAt: { $gte: dayStart, $lt: dayEnd } }),
    ServiceRequest.countDocuments({ technicianId: tech._id, status: 'COMPLETED', completedAt: { $gte: dayStart } }),
    EarningsLedger.aggregate([{ $match: { technicianId: tech._id, earnedAt: { $gte: dayStart } } }, { $group: { _id: null, total: { $sum: '$netEarning' } } }]),
    ServiceRequest.find({ technicianId: tech._id, status: { $in: COMMITTED_JOB_STATUSES }, scheduledAt: { $gte: new Date(Date.now() - 6 * 3600000) } }).sort({ scheduledAt: 1 }).limit(1),
  ]);

  const inProgress = active.find((j) => ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(j.status));
  res.json({
    success: true,
    technician: technicianService.adminTechnicianView(tech),
    stats: {
      todaysJobs: todays,
      pendingRequests: pending.length,
      completedJobs: tech.completedJobs,
      completedToday,
      todaysEarnings: round2(todayEarn[0] ? todayEarn[0].total : 0),
      rating: tech.rating,
      ratingCount: tech.ratingCount,
    },
    newRequests: await Promise.all(pending.map((j) => requestService.serializeForTechnician(j, tech))),
    activeJob: inProgress ? await requestService.serializeForTechnician(inProgress, tech) : null,
    nextJob: nextJobs[0] ? await requestService.serializeForTechnician(nextJobs[0], tech) : null,
  });
});

/** GET /api/technicians/jobs?group=pending|active|today|completed|cancelled|all */
exports.listJobs = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const group = String(req.query.group || 'all');
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { technicianId: tech._id };
  const { dayStart } = periodStarts();
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  if (group === 'pending') filter.status = 'ASSIGNED';
  else if (group === 'active') filter.status = { $in: COMMITTED_JOB_STATUSES };
  else if (group === 'today') { filter.status = { $in: ACTIVE_JOB_STATUSES }; filter.scheduledAt = { $gte: dayStart, $lt: dayEnd }; }
  else if (group === 'completed') filter.status = 'COMPLETED';
  else if (group === 'cancelled') filter.status = 'CANCELLED';

  const [jobs, total] = await Promise.all([
    ServiceRequest.find(filter).sort(group === 'completed' ? { completedAt: -1 } : { priority: -1, scheduledAt: 1 }).skip((page - 1) * limit).limit(limit),
    ServiceRequest.countDocuments(filter),
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), jobs: await Promise.all(jobs.map((j) => requestService.serializeForTechnician(j, tech))) });
});

/** GET /api/technicians/earnings  (Section 32) - computed from the ledger, not a single stored total. */
exports.earnings = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const { dayStart, weekStart, monthStart } = periodStarts();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));

  const sumSince = async (since) => {
    const r = await EarningsLedger.aggregate([{ $match: { technicianId: tech._id, earnedAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: '$netEarning' }, fees: { $sum: '$platformFee' } } }]);
    return { earned: round2(r[0] ? r[0].total : 0), fees: round2(r[0] ? r[0].fees : 0) };
  };
  const [today, week, month, all, pendingPayout, commissionDue, awaiting, rows, total] = await Promise.all([
    sumSince(dayStart),
    sumSince(weekStart),
    sumSince(monthStart),
    EarningsLedger.aggregate([{ $match: { technicianId: tech._id } }, { $group: { _id: null, total: { $sum: '$netEarning' }, fees: { $sum: '$platformFee' }, gross: { $sum: '$customerPaid' } } }]),
    EarningsLedger.aggregate([{ $match: { technicianId: tech._id, entryType: 'EARNING', paymentMethod: 'ONLINE', payoutStatus: 'PENDING' } }, { $group: { _id: null, total: { $sum: '$netEarning' } } }]),
    EarningsLedger.aggregate([{ $match: { technicianId: tech._id, entryType: 'EARNING', paymentMethod: 'CASH', commissionSettled: false, payoutStatus: 'IN_HAND' } }, { $group: { _id: null, total: { $sum: '$platformFee' } } }]),
    Payment.aggregate([{ $match: { technicianId: tech._id, status: 'PENDING' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    EarningsLedger.find({ technicianId: tech._id }).sort({ earnedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EarningsLedger.countDocuments({ technicianId: tech._id }),
  ]);

  res.json({
    success: true,
    summary: {
      today: today.earned,
      thisWeek: week.earned,
      thisMonth: month.earned,
      totalEarned: round2(all[0] ? all[0].total : 0),
      totalPlatformFees: round2(all[0] ? all[0].fees : 0),
      completedJobs: tech.completedJobs,
      pendingPayout: round2(pendingPayout[0] ? pendingPayout[0].total : 0), // online earnings the platform still owes
      commissionDueFromCash: round2(commissionDue[0] ? commissionDue[0].total : 0), // platform fee on cash jobs not yet settled
      awaitingCustomerPayment: { count: awaiting[0] ? awaiting[0].count : 0, amount: round2(awaiting[0] ? awaiting[0].amount : 0) },
    },
    transactions: rows.map((r) => ({
      _id: r._id,
      requestId: r.requestId,
      requestNumber: r.requestNumber,
      serviceName: r.serviceName,
      customerPaid: r.customerPaid,
      commissionRate: r.commissionRate,
      platformFee: r.platformFee,
      netEarning: r.netEarning,
      paymentMethod: r.paymentMethod,
      status: r.entryType === 'REVERSAL' || r.payoutStatus === 'REVERSED' ? 'REFUNDED' : 'PAID',
      payoutStatus: r.payoutStatus,
      entryType: r.entryType,
      earnedAt: r.earnedAt,
    })),
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

/** GET /api/technicians/ratings */
exports.ratings = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const rows = await Rating.find({ technicianId: tech._id }).sort({ createdAt: -1 }).limit(50).populate('customerId', 'name').populate('serviceId', 'name').lean();
  res.json({
    success: true,
    average: tech.rating,
    count: tech.ratingCount,
    ratings: rows.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt, customer: r.customerId ? r.customerId.name.split(' ')[0] : 'Customer', service: r.serviceId ? r.serviceId.name : '' })),
  });
});
