'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const paymentController = require('./controllers/paymentController');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // profile photos are served to the SPA from another origin in development
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The built SPA is served by this server in production, so the CSP must allow the third-party
      // scripts/frames it uses: Razorpay Checkout (payments), Google Maps / OpenStreetMap, Google Fonts.
      // Helmet's other default directives (object-src, base-uri, frame-ancestors...) stay in force.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com', 'https://maps.googleapis.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://www.openstreetmap.org'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://checkout.razorpay.com', 'https://maps.googleapis.com', 'https://nominatim.openstreetmap.org', 'ws:', 'wss:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          formAction: ["'self'", 'https://api.razorpay.com'],
        },
      },
    })
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression());
  if (!env.isProd) app.use(morgan('dev'));

  // Razorpay webhook needs the RAW body for signature verification => before express.json()
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentController.webhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(sanitize);
  app.use('/api', apiLimiter);

  // Only profile photos and service images are public. Aadhaar / certificates live in private_uploads/ and are never mounted.
  app.use('/uploads/photos', express.static(path.join(__dirname, 'uploads', 'photos'), { maxAge: '7d', index: false, dotfiles: 'deny' }));
  // Service images: files in server/Photos/ are served at /uploads/services/<file name>
  app.use('/uploads/services', express.static(path.join(__dirname, 'Photos'), { maxAge: '1d', index: false, dotfiles: 'deny' }));

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
  app.use('/api', routes);

  // Optional: serve the built React app from the same server (production single-host deployment)
  const dist = path.join(__dirname, '..', 'client', 'dist');
  if (env.isProd && require('fs').existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|uploads|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
