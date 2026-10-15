'use strict';

const rateLimit = require('express-rate-limit');

const json = (message) => (_req, res) => res.status(429).json({ success: false, message });

// Whole API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many requests. Please slow down.'),
});

// Login / register - brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many authentication attempts. Try again in a few minutes.'),
});

// Uploads / payments are comparatively expensive
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many requests. Please try again shortly.'),
});

module.exports = { apiLimiter, authLimiter, sensitiveLimiter };
