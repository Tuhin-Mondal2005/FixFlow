'use strict';

const SupportTicket = require('../models/SupportTicket');
const ServiceRequest = require('../models/ServiceRequest');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyAdmins } = require('../services/notificationService');

/** POST /api/support - dispute / support request for a COMPLETED service (Section 66) */
exports.create = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findOne({ _id: req.body.requestId, customerId: req.user._id });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'COMPLETED') throw ApiError.conflict('Support requests can be raised for completed services');
  const open = await SupportTicket.countDocuments({ requestId: request._id, status: { $in: ['OPEN', 'IN_REVIEW'] } });
  if (open) throw ApiError.conflict('There is already an open support request for this service');

  const ticket = await SupportTicket.create({
    ticketNumber: await Counter.next('ticket', 5000),
    customerId: req.user._id,
    requestId: request._id,
    requestNumber: request.requestNumber,
    subject: req.body.subject,
    message: req.body.message,
    category: req.body.category,
  });
  await notifyAdmins({
    title: 'New support request',
    message: `Ticket #${ticket.ticketNumber} for request #${request.requestNumber}: ${ticket.subject}`,
    type: 'SUPPORT_TICKET',
    data: { link: '/admin/support' },
  });
  res.status(201).json({ success: true, ticket });
});

/** GET /api/support/my */
exports.mine = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ customerId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, tickets });
});
