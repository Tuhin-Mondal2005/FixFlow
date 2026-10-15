'use strict';

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

function required(name, fallbackForDev) {
  const v = process.env[name];
  if (v && v.trim()) return v;
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable: ${name}`);
}

const env = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/fixflow'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-jwt-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Used to encrypt Aadhaar / certificate files at rest (AES-256-GCM)
  docEncryptionKey: required('DOC_ENCRYPTION_KEY', 'dev-only-insecure-document-key-change-me'),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  // Business timezone offset used to interpret "preferred date + time" from customers
  tzOffset: process.env.BUSINESS_TZ_OFFSET || '+05:30',
  sweeperIntervalSeconds: Number(process.env.SWEEPER_INTERVAL_SECONDS) || 30,
  adminSeed: {
    email: process.env.ADMIN_EMAIL || 'admin@fixflow.local',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
};

// Razorpay runs in MOCK mode when keys are absent (development only).
env.razorpay.mock = !(env.razorpay.keyId && env.razorpay.keySecret);

if (isProd) {
  if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
  if (env.docEncryptionKey.length < 32) throw new Error('DOC_ENCRYPTION_KEY must be at least 32 characters in production');
  if (env.razorpay.mock) throw new Error('Razorpay keys are required in production');
}

module.exports = env;
