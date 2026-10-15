'use strict';

/**
 * Central place for enums and DEFAULT business rules.
 * Anything that an admin may tune at runtime (weights, commission, timeouts)
 * lives in the Setting document; these values are only the seed defaults.
 */

const ROLES = Object.freeze({ CUSTOMER: 'CUSTOMER', TECHNICIAN: 'TECHNICIAN', ADMIN: 'ADMIN' });

const REQUEST_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  ON_THE_WAY: 'ON_THE_WAY',
  ARRIVED: 'ARRIVED',
  SERVICE_STARTED: 'SERVICE_STARTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

// Statuses where a technician is committed to the job (used for workload + conflicts)
const ACTIVE_JOB_STATUSES = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'];
// Statuses where the technician has confirmed the job
const COMMITTED_JOB_STATUSES = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'];
// Statuses in which the technician is physically working / travelling
const IN_PROGRESS_STATUSES = ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'];

// Section 16 - the customer may cancel until the service has started. Enforced in the backend.
const CUSTOMER_CANCELLABLE_STATUSES = ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'];

// Technician driven transitions (strict, one step at a time)
const TECHNICIAN_TRANSITIONS = Object.freeze({
  ACCEPTED: 'ON_THE_WAY',
  ON_THE_WAY: 'ARRIVED',
  ARRIVED: 'SERVICE_STARTED',
  SERVICE_STARTED: 'COMPLETED',
});

const STATUS_FLOW = ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED', 'COMPLETED'];

const URGENCY = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });
// Section 22
const PRIORITY_VALUES = Object.freeze({ LOW: 20, MEDIUM: 50, HIGH: 100 });

const AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
  ON_LEAVE: 'ON_LEAVE',
});

const VERIFICATION = Object.freeze({ PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

const PAYMENT_METHOD = Object.freeze({ CASH: 'CASH', ONLINE: 'ONLINE' });

const CATEGORIES = Object.freeze({
  APPLIANCE: 'APPLIANCE',
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING: 'PLUMBING',
  CLEANING: 'CLEANING',
});

const DEFAULT_SETTINGS = Object.freeze({
  // Section 19 - weights are configurable. Score = sum(weight * factor) / sum(weight).
  // Set experience to 0 to get exactly the suggested formula from the brief (40/25/20/10/5).
  assignmentWeights: { skill: 40, availability: 25, location: 20, workload: 10, rating: 5, experience: 5 },
  // Section 31
  commissionRates: { APPLIANCE: 15, ELECTRICAL: 15, PLUMBING: 15, CLEANING: 12 },
  // Section 24 / 28 - how long a technician has to answer an offer
  responseTimeoutMinutes: { LOW: 20, MEDIUM: 10, HIGH: 3 },
  noShowGraceMinutes: 30,
  maxAutoAttempts: 5,
  maxWorkload: 8,
  defaultServiceRadiusKm: 15,
  travelBufferMinutes: 30,
  maxWaitMinutes: 120,
});

module.exports = {
  ROLES,
  REQUEST_STATUS,
  ACTIVE_JOB_STATUSES,
  COMMITTED_JOB_STATUSES,
  IN_PROGRESS_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  TECHNICIAN_TRANSITIONS,
  STATUS_FLOW,
  URGENCY,
  PRIORITY_VALUES,
  AVAILABILITY,
  VERIFICATION,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  CATEGORIES,
  DEFAULT_SETTINGS,
};
