'use strict';

const mongoose = require('mongoose');

/**
 * Immutable-ish transaction history (Section 32). One row per paid job, plus a reversal row on refunds.
 *  - ONLINE earnings are held by the platform until an admin settles the payout (payoutStatus PENDING -> PAID_OUT).
 *  - CASH jobs: the technician already holds the money, so the platform fee is a commission DUE from the
 *    technician (commissionSettled false -> true).
 */
const earningsLedgerSchema = new mongoose.Schema(
  {
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    entryType: { type: String, enum: ['EARNING', 'REVERSAL'], default: 'EARNING' },
    serviceName: String,
    requestNumber: Number,
    customerPaid: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    netEarning: { type: Number, required: true }, // negative for reversals
    paymentMethod: { type: String, enum: ['CASH', 'ONLINE'], required: true },
    payoutStatus: { type: String, enum: ['PENDING', 'PAID_OUT', 'IN_HAND', 'REVERSED'], default: 'PENDING', index: true },
    commissionSettled: { type: Boolean, default: false }, // meaningful for CASH rows
    settledAt: Date,
    earnedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

earningsLedgerSchema.index({ paymentId: 1, entryType: 1 }, { unique: true });

module.exports = mongoose.model('EarningsLedger', earningsLedgerSchema);
