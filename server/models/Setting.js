'use strict';

const mongoose = require('mongoose');
const { DEFAULT_SETTINGS } = require('../config/constants');

// Single document (key = "global") holding every admin-tunable business rule.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    assignmentWeights: {
      skill: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.skill, min: 0, max: 100 },
      availability: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.availability, min: 0, max: 100 },
      location: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.location, min: 0, max: 100 },
      workload: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.workload, min: 0, max: 100 },
      rating: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.rating, min: 0, max: 100 },
      experience: { type: Number, default: DEFAULT_SETTINGS.assignmentWeights.experience, min: 0, max: 100 },
    },
    commissionRates: {
      APPLIANCE: { type: Number, default: DEFAULT_SETTINGS.commissionRates.APPLIANCE, min: 0, max: 60 },
      ELECTRICAL: { type: Number, default: DEFAULT_SETTINGS.commissionRates.ELECTRICAL, min: 0, max: 60 },
      PLUMBING: { type: Number, default: DEFAULT_SETTINGS.commissionRates.PLUMBING, min: 0, max: 60 },
      CLEANING: { type: Number, default: DEFAULT_SETTINGS.commissionRates.CLEANING, min: 0, max: 60 },
    },
    responseTimeoutMinutes: {
      LOW: { type: Number, default: DEFAULT_SETTINGS.responseTimeoutMinutes.LOW, min: 1, max: 240 },
      MEDIUM: { type: Number, default: DEFAULT_SETTINGS.responseTimeoutMinutes.MEDIUM, min: 1, max: 240 },
      HIGH: { type: Number, default: DEFAULT_SETTINGS.responseTimeoutMinutes.HIGH, min: 1, max: 240 },
    },
    noShowGraceMinutes: { type: Number, default: DEFAULT_SETTINGS.noShowGraceMinutes, min: 5, max: 240 },
    maxAutoAttempts: { type: Number, default: DEFAULT_SETTINGS.maxAutoAttempts, min: 1, max: 20 },
    maxWorkload: { type: Number, default: DEFAULT_SETTINGS.maxWorkload, min: 1, max: 50 },
    defaultServiceRadiusKm: { type: Number, default: DEFAULT_SETTINGS.defaultServiceRadiusKm, min: 1, max: 100 },
    travelBufferMinutes: { type: Number, default: DEFAULT_SETTINGS.travelBufferMinutes, min: 0, max: 180 },
    maxWaitMinutes: { type: Number, default: DEFAULT_SETTINGS.maxWaitMinutes, min: 0, max: 720 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
