'use strict';

/**
 * Pure scoring maths for the assignment engine (no database, no network - fully unit testable).
 * See assignmentService.js for how these are used in the pipeline.
 */

const { round2 } = require('../utils/geo');

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Closer technician => higher score. 0 km = 100, edge of their service radius = 0. */
const locationFactor = (distanceKm, radiusKm) => clamp(100 * (1 - distanceKm / Math.max(radiusKm, 0.1)));

/** Fewer active jobs => higher score (workload balancing, Section 21). */
const workloadFactor = (activeJobs, maxWorkload) => clamp(100 * (1 - activeJobs / Math.max(maxWorkload, 1)));

/** Rating 0-5 -> 0-100. Technicians without reviews get a neutral 75 so newcomers are not buried. */
const ratingFactor = (rating, ratingCount) => (ratingCount > 0 ? clamp((rating / 5) * 100) : 75);

/** 0 years = 0, 10+ years = 100 */
const experienceFactor = (years) => clamp((Math.min(years || 0, 10) / 10) * 100);

const WEIGHT_KEYS = ['skill', 'availability', 'location', 'workload', 'rating', 'experience'];

/**
 * Weighted matching score (Section 19). Weights are configurable and normalised, so the result is
 * always 0-100 regardless of what the admin types in.
 *   Matching Score = (Skill x40 + Availability x25 + Location x20 + Workload x10 + Rating x5 [+ Experience]) / sum(weights)
 */
function computeScore(factors, weights) {
  let total = 0;
  let weightSum = 0;
  for (const k of WEIGHT_KEYS) {
    const w = Number(weights[k]) || 0;
    total += w * (factors[k] || 0);
    weightSum += w;
  }
  return weightSum > 0 ? round2(total / weightSum) : 0;
}

/** Do [aStart,aEnd) and [bStart,bEnd) overlap? */
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

module.exports = {
  clamp,
  locationFactor,
  workloadFactor,
  ratingFactor,
  experienceFactor,
  computeScore,
  overlaps,
  WEIGHT_KEYS,
};
