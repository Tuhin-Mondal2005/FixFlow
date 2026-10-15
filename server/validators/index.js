'use strict';

const { z } = require('zod');
const { isValidAadhaar } = require('../utils/aadhaar');

/* ---------- reusable primitives ---------- */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(120);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
const name = z.string().trim().min(2, 'Name is too short').max(80);
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');
const urgency = z.enum(['LOW', 'MEDIUM', 'HIGH']);
// Full 12-digit Aadhaar number (spaces / dashes allowed). Checked with the Verhoeff digit.
const aadhaarNumber = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : v),
  z.string()
    .regex(/^\d{12}$/, 'Enter the 12-digit Aadhaar number')
    .refine((v) => isValidAadhaar(v), 'This Aadhaar number is not valid. Please check each digit.')
);
const boolFlag = z.enum(['true', 'false']).transform((v) => v === 'true');

// "a, b, c" | ["a","b"] | '["a","b"]'  ->  string[]
const stringList = (min = 0) =>
  z
    .preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v !== 'string') return v === undefined ? [] : v;
      const t = v.trim();
      if (t.startsWith('[')) {
        try { return JSON.parse(t); } catch { /* fall through */ }
      }
      return t ? t.split(',').map((s) => s.trim()).filter(Boolean) : [];
    }, z.array(z.string().trim().min(1).max(100)).max(30))
    .refine((a) => a.length >= min, `Select at least ${min}`);

/* ---------- auth ---------- */
const registerCustomer = z.object({
  name,
  email,
  phone,
  password,
  address: z.string().trim().min(5, 'Address is too short').max(300),
  // Sharing the current location on the map is mandatory at registration
  latitude: z.coerce.number({ invalid_type_error: 'Share your current location on the map', required_error: 'Share your current location on the map' }).min(-90).max(90),
  longitude: z.coerce.number({ invalid_type_error: 'Share your current location on the map', required_error: 'Share your current location on the map' }).min(-180).max(180),
});

const login = z.object({
  email,
  password: z.string().min(1).max(72),
  portal: z.enum(['CUSTOMER', 'TECHNICIAN', 'ADMIN']).optional(),
});

const updateProfile = z.object({
  name: name.optional(),
  phone: phone.optional(),
  address: z.string().trim().min(5).max(300).optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
});

const changePassword = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

/* ---------- technician ---------- */
const technicianRegister = z.object({
  name,
  email,
  phone,
  password,
  address: z.string().trim().min(5).max(300),
  latitude,
  longitude,
  skills: stringList(1),
  experience: z.coerce.number().min(0).max(60).default(0),
  certifications: stringList(0).default([]),
  aadhaarNumber,
  serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
});

const technicianProfileUpdate = z.object({
  name: name.optional(),
  phone: phone.optional(),
  address: z.string().trim().min(5).max(300).optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  skills: stringList(1).optional(),
  experience: z.coerce.number().min(0).max(60).optional(),
  certifications: stringList(0).optional(),
  serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
  workingHours: z.object({ start: timeStr, end: timeStr }).optional(),
});

const technicianAvailability = z.object({
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE', 'ON_LEAVE']),
  availableFrom: z.coerce.date().nullable().optional(),
  workingHours: z.object({ start: timeStr, end: timeStr }).optional(),
});

const jobStatusUpdate = z.object({
  status: z.enum(['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED', 'COMPLETED']),
  finalAmount: z.coerce.number().positive().max(100000).optional(),
  billNote: z.string().trim().max(300).optional(),
});

const jobReject = z.object({ reason: z.string().trim().max(200).optional() });

/* ---------- requests ---------- */
const createRequest = z.object({
  serviceId: objectId,
  packageName: z.string().trim().max(60).optional().default(''),
  problemDescription: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(1000),
  address: z.string().trim().min(5, 'Address is required').max(300),
  latitude,
  longitude,
  urgency: urgency.default('MEDIUM'),
  preferredDate: dateStr,
  preferredTime: timeStr,
  contactNumber: phone,
});

const cancelRequest = z.object({ reason: z.string().trim().max(300).optional().default('') });
const rescheduleRequest = z.object({ preferredDate: dateStr, preferredTime: timeStr });
const rateRequest = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(600).optional().default('') });

const listQuery = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ---------- payments ---------- */
const verifyPayment = z.object({
  razorpay_order_id: z.string().min(5).max(100),
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(10).max(200),
});

/* ---------- support ---------- */
const createTicket = z.object({
  requestId: objectId,
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  category: z.enum(['QUALITY', 'BILLING', 'BEHAVIOUR', 'NO_SHOW', 'OTHER']).default('OTHER'),
});
const updateTicket = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
  adminNote: z.string().trim().max(1000).optional().default(''),
});

/* ---------- admin ---------- */
const adminAssign = z.object({ technicianId: objectId, force: z.boolean().optional().default(false) });
const adminReassign = z.object({ technicianId: objectId.optional(), force: z.boolean().optional().default(false), reason: z.string().trim().max(200).optional() });
const adminCancel = z.object({ reason: z.string().trim().min(3, 'A reason is required').max(300) });
const adminReject = z.object({ reason: z.string().trim().min(3, 'A reason is required').max(300) });

const adminTechnicianCreate = z.object({
  name,
  email,
  phone,
  password,
  address: z.string().trim().min(5).max(300),
  latitude,
  longitude,
  skills: stringList(1),
  experience: z.coerce.number().min(0).max(60).default(0),
  certifications: stringList(0).default([]),
  serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
});

const adminTechnicianUpdate = technicianProfileUpdate.extend({ email: email.optional() });

const packageSchema = z.object({ name: z.string().trim().min(2).max(40), price: z.coerce.number().min(0).max(1000000), description: z.string().trim().max(200).optional().default('') });
const serviceBase = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug may contain a-z, 0-9 and -').max(60),
  category: z.enum(['APPLIANCE', 'ELECTRICAL', 'PLUMBING', 'CLEANING']),
  description: z.string().trim().max(500).optional().default(''),
  icon: z.string().trim().max(8).optional().default('🔧'),
  imageUrl: z.string().trim().max(500)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v) || /^\/uploads\/services\/[\w.-]+\.(jpe?g|png|webp)$/i.test(v), 'Use a web link (http:// or https://) or a file in /uploads/services/')
    .optional().default(''),
  startingPrice: z.coerce.number().min(0).max(1000000),
  packages: z.array(packageSchema).max(6).optional().default([]),
  durationMinutes: z.coerce.number().int().min(15).max(720).optional().default(60),
  commissionRate: z.coerce.number().min(0).max(60).nullable().optional(),
  minExperienceYears: z.coerce.number().min(0).max(30).optional().default(0),
  isActive: z.boolean().optional().default(true),
});
const serviceCreate = serviceBase;
const serviceUpdate = serviceBase.partial();

const num = (min, max) => z.coerce.number().min(min).max(max);
const settingsUpdate = z.object({
  assignmentWeights: z.object({ skill: num(0, 100), availability: num(0, 100), location: num(0, 100), workload: num(0, 100), rating: num(0, 100), experience: num(0, 100) }).partial().optional(),
  commissionRates: z.object({ APPLIANCE: num(0, 60), ELECTRICAL: num(0, 60), PLUMBING: num(0, 60), CLEANING: num(0, 60) }).partial().optional(),
  responseTimeoutMinutes: z.object({ LOW: num(1, 240), MEDIUM: num(1, 240), HIGH: num(1, 240) }).partial().optional(),
  noShowGraceMinutes: num(5, 240).optional(),
  maxAutoAttempts: num(1, 20).optional(),
  maxWorkload: num(1, 50).optional(),
  defaultServiceRadiusKm: num(1, 100).optional(),
  travelBufferMinutes: num(0, 180).optional(),
  maxWaitMinutes: num(0, 720).optional(),
});

const adminRequestsQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().optional(),
  urgency: urgency.optional(),
  serviceId: objectId.optional(),
  technicianId: objectId.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const adminTechniciansQuery = z.object({
  q: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  isActive: boolFlag.optional(),
  deleted: boolFlag.optional(),
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE', 'ON_LEAVE']).optional(),
  skill: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  objectId,
  registerCustomer,
  login,
  updateProfile,
  changePassword,
  technicianRegister,
  technicianProfileUpdate,
  technicianAvailability,
  jobStatusUpdate,
  jobReject,
  createRequest,
  cancelRequest,
  rescheduleRequest,
  rateRequest,
  listQuery,
  verifyPayment,
  createTicket,
  updateTicket,
  adminAssign,
  adminReassign,
  adminCancel,
  adminReject,
  adminTechnicianCreate,
  adminTechnicianUpdate,
  serviceCreate,
  serviceUpdate,
  settingsUpdate,
  adminRequestsQuery,
  adminTechniciansQuery,
};
