'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Technician = require('../models/Technician');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Pre-computed hash so that unknown e-mails cost the same time as wrong passwords (no user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

/** POST /api/auth/register - customers only. Technicians use /api/technicians/register; admins are seeded. */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, address, latitude, longitude } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role: 'CUSTOMER', // role is NEVER taken from the request body
    address: { line: address, latitude, longitude },
  });
  // Register -> Login -> Dashboard (Section 5): no token is issued here, the user logs in next.
  res.status(201).json({ success: true, message: 'Registration successful. Please log in.', user });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, portal } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +failedLogins +lockUntil +tokenVersion');

  if (user && user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(429, 'Too many failed attempts. This account is locked for a few minutes.');
  }

  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.failedLogins = 0;
      }
      await user.save();
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact support.');
  if (portal && portal !== user.role) {
    const label = user.role === 'CUSTOMER' ? 'customer' : user.role.toLowerCase();
    throw ApiError.forbidden(`This is a ${label} account. Please use the ${label} login.`);
  }

  let technician = null;
  if (user.role === 'TECHNICIAN') {
    technician = await Technician.findOne({ userId: user._id });
    if (!technician || technician.deletedAt) throw ApiError.forbidden('Technician profile not found');
    if (technician.verificationStatus === 'PENDING') {
      throw new ApiError(403, 'Your application is still under review. You can log in once an admin approves it.', { code: 'PENDING_VERIFICATION' });
    }
    if (technician.verificationStatus === 'REJECTED') {
      throw new ApiError(403, `Your application was rejected${technician.rejectionReason ? `: ${technician.rejectionReason}` : '.'}`, { code: 'REJECTED' });
    }
    if (!technician.isActive) throw new ApiError(403, 'Your technician account has been deactivated by an administrator.', { code: 'DEACTIVATED' });
  }

  user.failedLogins = 0;
  user.lockUntil = undefined;
  await user.save();

  res.json({
    success: true,
    token: signToken(user),
    user: user.toJSON(),
    technician: technician ? { _id: technician._id, availabilityStatus: technician.availabilityStatus, rating: technician.rating } : undefined,
  });
});

/** GET /api/auth/me */
exports.me = asyncHandler(async (req, res) => {
  const out = { success: true, user: req.user.toJSON() };
  if (req.user.role === 'TECHNICIAN') {
    const t = await Technician.findOne({ userId: req.user._id }).select('availabilityStatus rating verificationStatus isActive');
    out.technician = t;
  }
  res.json(out);
});

/** PUT /api/auth/profile */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, latitude, longitude } = req.body;
  const user = req.user;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address !== undefined) user.address.line = address;
  if (latitude !== undefined) user.address.latitude = latitude;
  if (longitude !== undefined) user.address.longitude = longitude;
  await user.save();
  res.json({ success: true, user: user.toJSON() });
});

/** PUT /api/auth/password - invalidates every other session via tokenVersion */
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ success: true, message: 'Password updated', token: signToken(user) });
});
