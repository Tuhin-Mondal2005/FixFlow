'use strict';

const ServiceRequest = require('../models/ServiceRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { currentTechnician } = require('./technicianController');
const requestService = require('../services/requestService');
const assignmentService = require('../services/assignmentService');
const technicianService = require('../services/technicianService');

/** GET /api/jobs/:id - a job that belongs to the logged-in technician */
exports.get = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const job = await ServiceRequest.findOne({ _id: req.params.id, technicianId: tech._id });
  if (!job) throw ApiError.notFound('Job not found');
  res.json({ success: true, job: await requestService.serializeForTechnician(job, tech) });
});

/** PUT /api/jobs/:id/accept  ASSIGNED -> ACCEPTED */
exports.accept = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  if (!tech.isActive || tech.verificationStatus !== 'APPROVED') throw ApiError.forbidden('Your account is not active');
  const job = await requestService.technicianAccept(req.params.id, tech, req.user);
  res.json({ success: true, job: await requestService.serializeForTechnician(job, tech) });
});

/** PUT /api/jobs/:id/reject  -> engine immediately offers the job to the next best technician */
exports.reject = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const out = await assignmentService.handleRejection(req.params.id, tech._id, req.user._id, (req.body && req.body.reason) || '');
  if (!out.released) throw ApiError.conflict('This request is no longer waiting for your response');
  await technicianService.syncTechnicianState(tech._id);
  res.json({ success: true, message: 'Request rejected. It has been offered to another technician.', reassigned: out.reassigned });
});

/** PUT /api/jobs/:id/status  ON_THE_WAY -> ARRIVED -> SERVICE_STARTED -> COMPLETED (strict order) */
exports.updateStatus = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const job = await requestService.technicianTransition(req.params.id, tech, req.user, req.body);
  res.json({ success: true, job: await requestService.serializeForTechnician(job, tech) });
});
