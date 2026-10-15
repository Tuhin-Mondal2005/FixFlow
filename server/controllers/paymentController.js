'use strict';

const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const paymentService = require('../services/paymentService');
const { currentTechnician } = require('./technicianController');

async function ownBill(req) {
  const payment = await Payment.findOne({ requestId: req.params.requestId, customerId: req.user._id });
  if (!payment) throw ApiError.notFound('No bill found for this request yet');
  return payment;
}

/** GET /api/payments/my */
exports.mine = asyncHandler(async (req, res) => {
  const rows = await Payment.find({ customerId: req.user._id }).sort({ createdAt: -1 }).limit(100).populate('requestId', 'requestNumber serviceName completedAt').populate('technicianId', 'name').lean();
  res.json({
    success: true,
    payments: rows.map((p) => ({
      _id: p._id,
      requestId: p.requestId && p.requestId._id,
      requestNumber: p.requestId && p.requestId.requestNumber,
      serviceName: p.requestId && p.requestId.serviceName,
      technician: p.technicianId && p.technicianId.name,
      amount: p.amount,
      method: p.method,
      status: p.status,
      invoiceNumber: p.invoiceNumber,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
  });
});

/** GET /api/payments/request/:requestId */
exports.getBill = asyncHandler(async (req, res) => {
  const p = await ownBill(req);
  const request = await ServiceRequest.findById(p.requestId).select('requestNumber serviceName packageName finalAmount billNote completedAt');
  res.json({ success: true, payment: { ...p.toObject(), gatewayOrderId: undefined }, request });
});

/** POST /api/payments/request/:requestId/online-order  -> Razorpay order */
exports.createOrder = asyncHandler(async (req, res) => {
  const p = await ownBill(req);
  const out = await paymentService.createOnlineOrder(p);
  res.json({ success: true, order: out.order, keyId: out.keyId, mock: out.mock, amount: p.amount });
});

/** POST /api/payments/verify - backend verifies the signature; the browser's claim is never trusted */
exports.verify = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const out = await paymentService.verifyOnlinePayment({ orderId, paymentId, signature });
  if (!out.payment.customerId.equals(req.user._id)) throw ApiError.forbidden();
  res.json({ success: true, message: 'Payment confirmed', status: out.payment.status, invoiceNumber: out.payment.invoiceNumber });
});

/** POST /api/payments/request/:requestId/cash - customer chooses to pay cash to the technician */
exports.chooseCash = asyncHandler(async (req, res) => {
  const p = await ownBill(req);
  await paymentService.chooseCash(p);
  res.json({ success: true, message: 'Pay the technician in cash. They will confirm receipt.', payment: p });
});

/** PUT /api/payments/:id/confirm-cash - the assigned technician confirms the cash was received */
exports.confirmCash = asyncHandler(async (req, res) => {
  const tech = await currentTechnician(req);
  const p = await Payment.findOne({ _id: req.params.id, technicianId: tech._id });
  if (!p) throw ApiError.notFound('Bill not found');
  if (p.status === 'PAID') throw ApiError.conflict('Already confirmed');
  if (p.method !== 'CASH') throw ApiError.conflict('The customer has not chosen to pay cash for this bill');
  const paid = await paymentService.markPaid(p._id, { method: 'CASH' });
  res.json({ success: true, message: 'Cash payment confirmed', payment: paid });
});

/** POST /api/payments/dev/mock-checkout - DEVELOPMENT ONLY (mock Razorpay): signs like the gateway would */
exports.mockCheckout = asyncHandler(async (req, res) => {
  if (env.isProd || !env.razorpay.mock) throw ApiError.notFound('Not available');
  const payment = await Payment.findOne({ gatewayOrderId: req.body.orderId, customerId: req.user._id });
  if (!payment) throw ApiError.notFound('Order not found');
  res.json({ success: true, result: paymentService.mockCheckoutResult(req.body.orderId) });
});

/** POST /api/payments/webhook - raw body, signature header checked */
exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const raw = req.body; // Buffer (express.raw)
  if (!Buffer.isBuffer(raw) || !signature || !paymentService.verifyWebhookSignature(raw, signature)) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }
  const event = JSON.parse(raw.toString('utf8'));
  const out = await paymentService.handleWebhookEvent(event);
  res.json({ success: true, ...out });
});
