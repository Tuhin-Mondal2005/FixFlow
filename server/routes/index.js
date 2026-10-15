'use strict';

const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
const { technicianUpload } = require('../middleware/upload');
const v = require('../validators');

const auth = require('../controllers/authController');
const services = require('../controllers/serviceController');
const tech = require('../controllers/technicianController');
const jobs = require('../controllers/jobController');
const requests = require('../controllers/requestController');
const payments = require('../controllers/paymentController');
const notifications = require('../controllers/notificationController');
const support = require('../controllers/supportController');
const admin = require('../controllers/adminController');

const router = express.Router();
const C = authorize('CUSTOMER');
const T = authorize('TECHNICIAN');
const A = authorize('ADMIN');

/* ---------------- Auth (Section 54) ---------------- */
router.post('/auth/register', authLimiter, validate(v.registerCustomer), auth.register);
router.post('/auth/login', authLimiter, validate(v.login), auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/profile', protect, validate(v.updateProfile), auth.updateProfile);
router.put('/auth/password', protect, authLimiter, validate(v.changePassword), auth.changePassword);

/* ---------------- Services (public) ---------------- */
router.get('/services', services.list);
router.get('/services/public/reviews', services.latestReviews);
router.get('/services/:id', services.get);

/* ---------------- Customer requests ---------------- */
router.post('/requests', protect, C, validate(v.createRequest), requests.create);
router.get('/requests/my', protect, C, requests.mine);
router.get('/requests/summary', protect, C, requests.summary);
router.get('/requests/ratings/mine', protect, C, requests.myRatings);
router.get('/requests/:id', protect, C, requests.get);
router.put('/requests/:id/cancel', protect, C, validate(v.cancelRequest), requests.cancel);
router.put('/requests/:id/reschedule', protect, C, validate(v.rescheduleRequest), requests.reschedule);
router.post('/requests/:id/rating', protect, C, validate(v.rateRequest), requests.rate);
router.get('/requests/:id/invoice', protect, requests.invoice);

/* ---------------- Technician ---------------- */
router.post('/technicians/register', sensitiveLimiter, technicianUpload, validate(v.technicianRegister), tech.register);
router.get('/technicians/profile', protect, T, tech.getProfile);
router.put('/technicians/profile', protect, T, technicianUpload, validate(v.technicianProfileUpdate), tech.updateProfile);
router.put('/technicians/availability', protect, T, validate(v.technicianAvailability), tech.updateAvailability);
router.get('/technicians/dashboard', protect, T, tech.dashboard);
router.get('/technicians/jobs', protect, T, tech.listJobs);
router.get('/technicians/earnings', protect, T, tech.earnings);
router.get('/technicians/ratings', protect, T, tech.ratings);

/* ---------------- Jobs (technician actions) ---------------- */
router.get('/jobs/:id', protect, T, jobs.get);
router.put('/jobs/:id/accept', protect, T, jobs.accept);
router.put('/jobs/:id/reject', protect, T, validate(v.jobReject), jobs.reject);
router.put('/jobs/:id/status', protect, T, validate(v.jobStatusUpdate), jobs.updateStatus);

/* ---------------- Payments ---------------- */
router.get('/payments/my', protect, C, payments.mine);
router.get('/payments/request/:requestId', protect, C, payments.getBill);
router.post('/payments/request/:requestId/online-order', protect, C, sensitiveLimiter, payments.createOrder);
router.post('/payments/request/:requestId/cash', protect, C, payments.chooseCash);
router.post('/payments/verify', protect, C, sensitiveLimiter, validate(v.verifyPayment), payments.verify);
router.put('/payments/:id/confirm-cash', protect, T, payments.confirmCash);
router.post('/payments/dev/mock-checkout', protect, C, payments.mockCheckout);
// NOTE: POST /payments/webhook is mounted in server.js BEFORE express.json() because it needs the raw body.

/* ---------------- Notifications ---------------- */
router.get('/notifications', protect, notifications.list);
router.put('/notifications/read-all', protect, notifications.markAllRead);
router.put('/notifications/:id/read', protect, notifications.markRead);

/* ---------------- Support / disputes ---------------- */
router.post('/support', protect, C, validate(v.createTicket), support.create);
router.get('/support/my', protect, C, support.mine);

/* ---------------- Admin ---------------- */
const admr = express.Router();
admr.use(protect, A);
admr.get('/dashboard', admin.dashboard);

admr.get('/technicians', validate(v.adminTechniciansQuery, 'query'), admin.listTechnicians);
admr.post('/technicians', validate(v.adminTechnicianCreate), admin.createTechnician);
admr.get('/technicians/:id', admin.getTechnician);
admr.put('/technicians/:id', validate(v.adminTechnicianUpdate), admin.updateTechnician);
admr.delete('/technicians/:id', admin.deleteTechnician);
admr.get('/technicians/:id/aadhaar', admin.revealAadhaar);
admr.get('/technicians/:id/documents/:kind/:index', admin.viewDocument);
admr.put('/technicians/:id/approve', admin.approveTechnician);
admr.put('/technicians/:id/reject', validate(v.adminReject), admin.rejectTechnician);
admr.put('/technicians/:id/activate', admin.activateTechnician);
admr.put('/technicians/:id/deactivate', admin.deactivateTechnician);

admr.get('/requests', validate(v.adminRequestsQuery, 'query'), admin.listRequests);
admr.get('/requests/:id', admin.getRequest);
admr.get('/requests/:id/candidates', admin.candidates);
admr.put('/requests/:id/assign', validate(v.adminAssign), admin.assignRequest);
admr.put('/requests/:id/reassign', validate(v.adminReassign), admin.reassignRequest);
admr.put('/requests/:id/auto-assign', admin.autoAssign);
admr.put('/requests/:id/cancel', validate(v.adminCancel), admin.cancelRequest);

admr.get('/reviews', admin.listReviews);
admr.get('/services', admin.listServices);
admr.post('/services', validate(v.serviceCreate), admin.createService);
admr.put('/services/:id', validate(v.serviceUpdate), admin.updateService);
admr.delete('/services/:id', admin.deleteService);

admr.get('/settings', admin.getSettings);
admr.put('/settings', validate(v.settingsUpdate), admin.updateSettings);

admr.get('/payments', admin.listPayments);
admr.put('/payments/:id/refund', admin.refundPayment);
admr.post('/payouts/:technicianId/settle', admin.settlePayout);

admr.get('/audit-logs', admin.auditLogs);
admr.get('/support', admin.listTickets);
admr.put('/support/:id', validate(v.updateTicket), admin.updateTicket);

router.use('/admin', admr);

module.exports = router;
