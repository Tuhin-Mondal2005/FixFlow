'use strict';

const mongoose = require('mongoose');
const { CATEGORIES } = require('../config/constants');

// NOTE: FixFlow is SERVICE ONLY. A "package" is a level of service (Basic/Deep/Premium),
// never a physical product. There is no product, inventory, cart or spare-parts model anywhere.
const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, // doubles as the skill key
    category: { type: String, enum: Object.values(CATEGORIES), required: true, index: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '🔧' },
    imageUrl: { type: String, default: '' },
    startingPrice: { type: Number, required: true, min: 0 }, // shown as "Starting from ₹X" (demo value)
    packages: { type: [packageSchema], default: [] },
    durationMinutes: { type: Number, default: 60, min: 15, max: 720 },
    commissionRate: { type: Number, default: null, min: 0, max: 60 }, // null => category default from settings
    minExperienceYears: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
