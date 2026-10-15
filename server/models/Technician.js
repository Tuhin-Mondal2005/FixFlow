'use strict';

const mongoose = require('mongoose');
const { AVAILABILITY, VERIFICATION } = require('../config/constants');

const docSchema = new mongoose.Schema(
  {
    // Name of the encrypted file inside private storage. NEVER exposed to clients.
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const technicianSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    profilePhoto: { type: String, default: '' }, // public path, e.g. /uploads/photos/xyz.jpg

    location: {
      address: { type: String, trim: true, default: '' },
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    serviceRadiusKm: { type: Number, default: 15, min: 1, max: 100 },
    // Last live position reported while travelling to a job (Socket.IO)
    liveLocation: {
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },

    skills: { type: [String], default: [], index: true }, // service slugs (Service.slug)
    experience: { type: Number, default: 0, min: 0, max: 60 }, // years
    certifications: { type: [String], default: [] },

    // Sensitive documents (encrypted at rest, admin-only access)
    aadhaarDocument: { type: docSchema, default: null },
    aadhaarLast4: { type: String, default: '' }, // last 4 digits, used for masked display
    // Full 12-digit Aadhaar number, AES-256-GCM encrypted. Not selected by default; admin reveal only.
    aadhaarNumberEncrypted: { type: String, default: '', select: false },
    qualificationDocuments: { type: [docSchema], default: [] },

    verificationStatus: { type: String, enum: Object.values(VERIFICATION), default: VERIFICATION.PENDING, index: true },
    rejectionReason: { type: String, default: '' },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: false }, // becomes true on approval
    deletedAt: { type: Date, default: null },

    availabilityStatus: { type: String, enum: Object.values(AVAILABILITY), default: AVAILABILITY.OFFLINE },
    availableFrom: { type: Date, default: null }, // "Available After: 3:00 PM" when BUSY
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '20:00' },
    },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    currentJobs: { type: Number, default: 0 }, // denormalised count of active jobs
    currentStatus: { type: String, default: 'Idle' }, // human readable, e.g. "On job: AC Repair #1024"

    missedResponses: { type: Number, default: 0 },
    noShows: { type: Number, default: 0 },
  },
  { timestamps: true }
);

technicianSchema.index({ verificationStatus: 1, isActive: 1, deletedAt: 1 });
technicianSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

module.exports = mongoose.model('Technician', technicianSchema);
