'use strict';

const mongoose = require('mongoose');

// Section 66 - Support / dispute for completed services
const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: Number, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, index: true },
    requestNumber: Number,
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: ['QUALITY', 'BILLING', 'BEHAVIOUR', 'NO_SHOW', 'OTHER'], default: 'OTHER' },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'], default: 'OPEN', index: true },
    adminNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
