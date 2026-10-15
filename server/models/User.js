'use strict';

const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, default: ROLES.CUSTOMER },
    address: {
      line: { type: String, trim: true, maxlength: 300, default: '' },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    isActive: { type: Boolean, default: true },
    // Brute-force protection
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    // Incrementing this invalidates all previously issued JWTs (password change, forced logout)
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

userSchema.index({ role: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.failedLogins;
    delete ret.lockUntil;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
