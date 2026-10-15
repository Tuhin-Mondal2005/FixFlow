'use strict';

const mongoose = require('mongoose');
const { REQUEST_STATUS, URGENCY } = require('../config/constants');

const attemptSchema = new mongoose.Schema(
  {
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    technicianName: String,
    score: Number,
    mode: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO' },
    outcome: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'NO_SHOW', 'REASSIGNED', 'CANCELLED', 'DEACTIVATED', 'RESCHEDULED'],
      default: 'PENDING',
    },
    reason: String,
    at: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: String,
    note: String,
  },
  { _id: false }
);

const serviceRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: Number, required: true, unique: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', default: null, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    serviceName: { type: String, required: true }, // denormalised snapshot
    serviceSlug: { type: String, required: true },
    category: { type: String, required: true },
    packageName: { type: String, default: '' },

    problemDescription: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    urgency: { type: String, enum: Object.values(URGENCY), default: URGENCY.MEDIUM },
    priority: { type: Number, required: true, index: true }, // LOW=20 MEDIUM=50 HIGH=100
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    scheduledAt: { type: Date, required: true, index: true }, // preferredDate + preferredTime in business TZ
    durationMinutes: { type: Number, default: 60 },
    contactNumber: { type: String, required: true },

    location: {
      address: { type: String, required: true, trim: true, maxlength: 300 },
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },

    status: { type: String, enum: Object.values(REQUEST_STATUS), default: REQUEST_STATUS.SUBMITTED, index: true },
    statusHistory: { type: [historySchema], default: [] },

    price: { type: Number, required: true, min: 0 }, // estimated / quoted price
    finalAmount: { type: Number, default: null, min: 0 }, // final bill set at completion
    billNote: { type: String, default: '' },

    assignment: {
      mode: { type: String, enum: ['AUTO', 'MANUAL', null], default: null },
      score: Number,
      offeredAt: Date,
      expiresAt: { type: Date, index: true }, // technician must answer before this
      etaStart: Date, // estimated start when the technician is still finishing another job
      attempts: { type: [attemptSchema], default: [] },
      excludedTechnicianIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      lastRanking: { type: [mongoose.Schema.Types.Mixed], default: [] }, // top candidates incl. score breakdown
      nextAvailableSlot: { type: Date, default: null },
      needsAdmin: { type: Boolean, default: false }, // nobody suitable right now
      autoDisabled: { type: Boolean, default: false }, // auto engine must not touch it any more
      lastRunAt: Date,
      attemptsResetAt: Date, // admin pressed "auto-assign" again => earlier automatic attempts no longer count
    },

    cancelledBy: { type: String, enum: ['CUSTOMER', 'ADMIN', 'SYSTEM', null], default: null },
    cancelReason: { type: String, default: '' },
    rescheduleCount: { type: Number, default: 0 },

    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    ratingReminderSent: { type: Boolean, default: false },
    isRated: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'UNPAID' },
  },
  { timestamps: true }
);

// Queue ordering: highest priority first, then oldest first
serviceRequestSchema.index({ status: 1, priority: -1, createdAt: 1 });
serviceRequestSchema.index({ technicianId: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
