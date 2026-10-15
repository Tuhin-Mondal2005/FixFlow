'use strict';

const mongoose = require('mongoose');

// Section 66 - Admin audit log
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminName: String,
    action: { type: String, required: true, index: true }, // e.g. TECHNICIAN_APPROVED
    entityType: { type: String, required: true }, // TECHNICIAN | REQUEST | SERVICE | PAYMENT | SETTINGS | SUPPORT
    entityId: { type: String },
    summary: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
