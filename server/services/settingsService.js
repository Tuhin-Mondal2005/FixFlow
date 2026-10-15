'use strict';

const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');

let cache = null;
let cachedAt = 0;
const TTL_MS = 10_000;

/** Returns the global settings as a plain object (creates the document with defaults on first use). */
async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  let doc = await Setting.findOne({ key: 'global' });
  if (!doc) doc = await Setting.create({ key: 'global' });
  cache = doc.toObject();
  cachedAt = Date.now();
  return cache;
}

async function updateSettings(patch) {
  const doc = (await Setting.findOne({ key: 'global' })) || new Setting({ key: 'global' });
  const merge = (target, src) => {
    for (const [k, v] of Object.entries(src || {})) {
      if (v && typeof v === 'object') merge(target[k], v);
      else target[k] = v;
    }
  };
  const before = doc.toObject();
  const next = {
    assignmentWeights: patch.assignmentWeights,
    commissionRates: patch.commissionRates,
    responseTimeoutMinutes: patch.responseTimeoutMinutes,
    noShowGraceMinutes: patch.noShowGraceMinutes,
    maxAutoAttempts: patch.maxAutoAttempts,
    maxWorkload: patch.maxWorkload,
    defaultServiceRadiusKm: patch.defaultServiceRadiusKm,
    travelBufferMinutes: patch.travelBufferMinutes,
    maxWaitMinutes: patch.maxWaitMinutes,
  };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object') merge(doc[k], v);
    else doc[k] = v;
  }
  const w = doc.assignmentWeights;
  const total = w.skill + w.availability + w.location + w.workload + w.rating + w.experience;
  if (total <= 0) throw ApiError.badRequest('At least one assignment weight must be greater than zero');
  await doc.save();
  cache = null;
  return { before, after: doc.toObject() };
}

function clearSettingsCache() {
  cache = null;
}

module.exports = { getSettings, updateSettings, clearSettingsCache };
