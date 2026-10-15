'use strict';

/**
 * Payments (Section 30, 31, 32).
 *  - Cash:   customer picks cash -> technician confirms receipt -> PAID.
 *  - Online: Razorpay order -> checkout -> BACKEND verifies the HMAC signature -> PAID.
 *            The webhook is a second, independent confirmation path (payment.captured / failed / refund).
 *  A payment is NEVER marked PAID because the browser said so.
 *  When a payment becomes PAID the commission is calculated and a row is written to the earnings ledger.
 */

const crypto = require('crypto');
const env = require('../config/env');
const Payment = require('../models/Payment');
const EarningsLedger = require('../models/EarningsLedger');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const Technician = require('../models/Technician');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { commissionRateFor, splitAmount } = require('./pricingService');
const { notify } = require('./notificationService');

let razorpayClient = null;
function getRazorpay() {
  if (env.razorpay.mock) return null;
  if (!razorpayClient) {
    // eslint-disable-next-line global-require
    const Razorpay = require('razorpay');
    razorpayClient = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return razorpayClient;
}

// In mock (development) mode we sign with a local secret so the SAME verification code path runs.
const signingSecret = () => (env.razorpay.mock ? `mock-${env.jwtSecret}` : env.razorpay.keySecret);

const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Razorpay checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
function verifyCheckoutSignature(orderId, paymentId, signature) {
  return safeEqualHex(hmac(signingSecret(), `${orderId}|${paymentId}`), signature);
}

/** Webhook signature = HMAC_SHA256(raw_body, webhook_secret). */
function verifyWebhookSignature(rawBody, signature) {
  const secret = env.razorpay.webhookSecret || (env.razorpay.mock ? signingSecret() : '');
  if (!secret) return false;
  return safeEqualHex(hmac(secret, rawBody), signature);
}

/** Development helper: what Razorpay's checkout would return after a successful payment. */
function mockCheckoutResult(orderId) {
  if (!env.razorpay.mock) throw ApiError.forbidden('Mock payments are disabled when Razorpay keys are configured');
  const paymentId = `pay_mock_${crypto.randomBytes(7).toString('hex')}`;
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: hmac(signingSecret(), `${orderId}|${paymentId}`) };
}

/** Called by the technician when the job is completed: creates the PENDING bill. */
async function createBill(request, finalAmount) {
  const existing = await Payment.findOne({ requestId: request._id });
  if (existing) return existing;
  return Payment.create({
    requestId: request._id,
    customerId: request.customerId,
    technicianId: request.technicianId,
    amount: finalAmount,
    status: 'PENDING',
  });
}

/** Create (or reuse) a Razorpay order for an unpaid bill. */
async function createOnlineOrder(payment) {
  if (payment.status === 'PAID' || payment.status === 'REFUNDED') throw ApiError.conflict('This bill is already settled');
  const amountPaise = Math.round(payment.amount * 100);
  if (amountPaise < 100) throw ApiError.badRequest('Amount is too small for online payment');

  let order;
  const client = getRazorpay();
  if (client) {
    order = await client.orders.create({ amount: amountPaise, currency: 'INR', receipt: `ff_${payment._id}`.slice(0, 40), notes: { requestId: payment.requestId.toString() } });
  } else {
    order = { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, amount: amountPaise, currency: 'INR' };
  }
  payment.method = 'ONLINE';
  payment.status = 'PENDING';
  payment.gatewayOrderId = order.id;
  payment.failureReason = undefined;
  await payment.save();
  await ServiceRequest.updateOne({ _id: payment.requestId }, { $set: { paymentStatus: 'PENDING' } });
  return { order, keyId: env.razorpay.keyId || 'rzp_test_mock', mock: env.razorpay.mock };
}

/**
 * Atomically flip PENDING/FAILED -> PAID (idempotent: webhook + browser verify can race safely),
 * then calculate commission and write the ledger.
 */
async function markPaid(paymentId, { method, gatewayPaymentId }) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['PENDING', 'FAILED'] } },
    { $set: { status: 'PAID', method, paidAt: new Date(), ...(gatewayPaymentId ? { paymentId: gatewayPaymentId } : {}), failureReason: undefined } },
    { new: true }
  );
  if (!payment) return Payment.findById(paymentId); // already processed

  const request = await ServiceRequest.findById(payment.requestId);
  const service = await Service.findById(request.serviceId);
  const rate = await commissionRateFor(service);
  const { commission, technicianEarning } = splitAmount(payment.amount, rate);
  const invoiceNumber = `FF-${new Date().getFullYear()}-${await Counter.next('invoice', 100000)}`;

  payment.commissionRate = rate;
  payment.commission = commission;
  payment.technicianEarning = technicianEarning;
  payment.invoiceNumber = invoiceNumber;
  await payment.save();

  await EarningsLedger.updateOne(
    { paymentId: payment._id, entryType: 'EARNING' },
    {
      $setOnInsert: {
        technicianId: payment.technicianId,
        requestId: payment.requestId,
        paymentId: payment._id,
        entryType: 'EARNING',
        serviceName: request.serviceName,
        requestNumber: request.requestNumber,
        customerPaid: payment.amount,
        commissionRate: rate,
        platformFee: commission,
        netEarning: technicianEarning,
        paymentMethod: method,
        // ONLINE: platform holds the money until payout. CASH: technician already has it.
        payoutStatus: method === 'ONLINE' ? 'PENDING' : 'IN_HAND',
        commissionSettled: method === 'ONLINE',
        earnedAt: new Date(),
      },
    },
    { upsert: true }
  );

  await ServiceRequest.updateOne({ _id: request._id }, { $set: { paymentStatus: 'PAID' } });

  const tech = await Technician.findById(payment.technicianId).select('userId');
  await notify(payment.customerId, {
    title: 'Payment confirmed',
    message: `₹${payment.amount} received for request #${request.requestNumber}. Invoice ${invoiceNumber} is ready.`,
    type: 'PAYMENT_CONFIRMED',
    data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/customer/invoice/${request._id}` },
  });
  if (tech) {
    await notify(tech.userId, {
      title: 'Payment received',
      message: `Request #${request.requestNumber}: you earned ₹${technicianEarning} (platform fee ₹${commission}).`,
      type: 'PAYMENT_CONFIRMED',
      data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: '/technician/earnings' },
    });
  }
  if (!request.isRated) {
    await notify(payment.customerId, {
      title: 'How was the service?',
      message: `Please rate your technician for request #${request.requestNumber}.`,
      type: 'RATING_REMINDER',
      data: { requestId: request._id.toString(), requestNumber: request.requestNumber, link: `/customer/rating?request=${request._id}` },
    });
    await ServiceRequest.updateOne({ _id: request._id }, { $set: { ratingReminderSent: true } });
  }
  return payment;
}

/** Browser returned from checkout: verify the signature on the server. */
async function verifyOnlinePayment({ orderId, paymentId, signature }) {
  const payment = await Payment.findOne({ gatewayOrderId: orderId });
  if (!payment) throw ApiError.notFound('Payment order not found');
  if (payment.status === 'PAID') return { payment, alreadyPaid: true };

  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { $set: { status: 'FAILED', failureReason: 'Signature verification failed' } });
    throw ApiError.badRequest('Payment verification failed');
  }

  // Extra safety with a live gateway: confirm the payment really belongs to this order, is captured and the amount matches.
  const client = getRazorpay();
  if (client) {
    const remote = await client.payments.fetch(paymentId);
    const expected = Math.round(payment.amount * 100);
    if (remote.order_id !== orderId || Number(remote.amount) !== expected || !['captured', 'authorized'].includes(remote.status)) {
      await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { $set: { status: 'FAILED', failureReason: 'Gateway mismatch' } });
      throw ApiError.badRequest('Payment could not be confirmed with the gateway');
    }
  }
  const paid = await markPaid(payment._id, { method: 'ONLINE', gatewayPaymentId: paymentId });
  return { payment: paid, alreadyPaid: false };
}

/** Customer chose to pay cash; technician later confirms. */
async function chooseCash(payment) {
  if (payment.status === 'PAID' || payment.status === 'REFUNDED') throw ApiError.conflict('This bill is already settled');
  payment.method = 'CASH';
  payment.status = 'PENDING';
  await payment.save();
  await ServiceRequest.updateOne({ _id: payment.requestId }, { $set: { paymentStatus: 'PENDING' } });
  return payment;
}

/** Webhook events (signature already verified by the controller). */
async function handleWebhookEvent(event) {
  const type = event.event;
  const entity = event.payload && event.payload.payment && event.payload.payment.entity;
  if (type === 'payment.captured' && entity) {
    const payment = await Payment.findOne({ gatewayOrderId: entity.order_id });
    if (payment && Math.round(payment.amount * 100) === Number(entity.amount)) await markPaid(payment._id, { method: 'ONLINE', gatewayPaymentId: entity.id });
    return { handled: true };
  }
  if (type === 'payment.failed' && entity) {
    const failed = await Payment.findOneAndUpdate(
      { gatewayOrderId: entity.order_id, status: 'PENDING' },
      { $set: { status: 'FAILED', failureReason: (entity.error_description || 'Payment failed').slice(0, 200) } },
      { new: true }
    );
    if (failed) await ServiceRequest.updateOne({ _id: failed.requestId }, { $set: { paymentStatus: 'FAILED' } });
    return { handled: true };
  }
  if (type === 'refund.processed') {
    const refund = event.payload.refund && event.payload.refund.entity;
    if (refund) await applyRefund(await Payment.findOne({ paymentId: refund.payment_id }), refund.id);
    return { handled: true };
  }
  return { handled: false };
}

/** Mark REFUNDED and reverse the technician's ledger entry. */
async function applyRefund(payment, refundId) {
  if (!payment || payment.status !== 'PAID') return payment;
  payment.status = 'REFUNDED';
  payment.refundId = refundId || payment.refundId;
  payment.refundedAt = new Date();
  await payment.save();
  const original = await EarningsLedger.findOne({ paymentId: payment._id, entryType: 'EARNING' });
  if (original) {
    await EarningsLedger.updateOne({ _id: original._id }, { $set: { payoutStatus: 'REVERSED' } });
    await EarningsLedger.updateOne(
      { paymentId: payment._id, entryType: 'REVERSAL' },
      {
        $setOnInsert: {
          technicianId: original.technicianId,
          requestId: original.requestId,
          paymentId: payment._id,
          entryType: 'REVERSAL',
          serviceName: original.serviceName,
          requestNumber: original.requestNumber,
          customerPaid: -original.customerPaid,
          commissionRate: original.commissionRate,
          platformFee: -original.platformFee,
          netEarning: -original.netEarning,
          paymentMethod: original.paymentMethod,
          payoutStatus: 'REVERSED',
          commissionSettled: true,
          earnedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  await ServiceRequest.updateOne({ _id: payment.requestId }, { $set: { paymentStatus: 'REFUNDED' } });
  await notify(payment.customerId, { title: 'Payment refunded', message: `₹${payment.amount} has been refunded.`, type: 'PAYMENT_REFUNDED', data: { requestId: payment.requestId.toString() } });
  return payment;
}

/** Admin initiated refund (calls Razorpay when live). */
async function refundPayment(payment) {
  if (payment.status !== 'PAID') throw ApiError.conflict('Only paid bills can be refunded');
  let refundId = `refund_manual_${Date.now()}`;
  const client = getRazorpay();
  if (payment.method === 'ONLINE' && client && payment.paymentId) {
    const refund = await client.payments.refund(payment.paymentId, { amount: Math.round(payment.amount * 100) });
    refundId = refund.id;
  }
  return applyRefund(payment, refundId);
}

module.exports = {
  createBill,
  createOnlineOrder,
  verifyOnlinePayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  mockCheckoutResult,
  chooseCash,
  markPaid,
  handleWebhookEvent,
  refundPayment,
};
