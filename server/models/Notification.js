'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'INFO', index: true }, // e.g. REQUEST_SUBMITTED, TECHNICIAN_ASSIGNED, PAYMENT_CONFIRMED
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // { requestId, requestNumber, link }
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
