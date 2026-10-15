'use strict';

const Service = require('../models/Service');
const Rating = require('../models/Rating');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/mask');

/** GET /api/services?category=&q= - public catalogue (active services only). Prices are "Starting from" demo values. */
exports.list = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category && ['APPLIANCE', 'ELECTRICAL', 'PLUMBING', 'CLEANING'].includes(String(req.query.category).toUpperCase())) {
    filter.category = String(req.query.category).toUpperCase();
  }
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
  const services = await Service.find(filter).sort({ category: 1, name: 1 }).lean();
  res.json({ success: true, count: services.length, services });
});

/** GET /api/services/:id - id or slug, plus a few recent reviews */
exports.get = asyncHandler(async (req, res) => {
  const key = req.params.id;
  const service = /^[a-f\d]{24}$/i.test(key) ? await Service.findById(key).lean() : await Service.findOne({ slug: key }).lean();
  if (!service || !service.isActive) throw ApiError.notFound('Service not found');
  const reviews = await Rating.find({ serviceId: service._id }).sort({ createdAt: -1 }).limit(6).populate('customerId', 'name').lean();
  res.json({
    success: true,
    service,
    reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt, customer: r.customerId ? r.customerId.name.split(' ')[0] : 'Customer' })),
  });
});

/** GET /api/services/public/reviews - latest reviews for the homepage carousel */
exports.latestReviews = asyncHandler(async (_req, res) => {
  const reviews = await Rating.find({ comment: { $ne: '' }, rating: { $gte: 4 } })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('customerId', 'name')
    .populate('serviceId', 'name')
    .lean();
  res.json({
    success: true,
    reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, customer: r.customerId ? r.customerId.name.split(' ')[0] : 'Customer', service: r.serviceId ? r.serviceId.name : '' })),
  });
});
