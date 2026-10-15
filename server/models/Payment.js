'use strict';

const mongoose = require('mongoose');
const { PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true, index: true },
    amount: { type: Number, required: true, min: 0 }, // what the customer pays (final bill)
    commissionRate: { type: Number, default: 0 },
    commission: { type: Number, default: 0 }, // platform fee
    technicianEarning: { type: Number, default: 0 },
    method: { type: String, enum: [...Object.values(PAYMENT_METHOD), null], default: null },
    gatewayOrderId: { type: String, index: true, sparse: true },
    paymentId: { type: String, index: true, sparse: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING, index: true },
    paidAt: Date,
    failureReason: String,
    refundId: String,
    refundedAt: Date,
    invoiceNumber: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
