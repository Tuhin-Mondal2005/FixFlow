'use strict';

const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, unique: true }, // one review per job
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('Rating', ratingSchema);
