'use strict';

const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');
const { initSockets } = require('./sockets');
const documentService = require('./services/documentService');
const assignmentService = require('./services/assignmentService');
const technicianService = require('./services/technicianService');
const { getSettings } = require('./services/settingsService');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function ensureAdmin() {
  const exists = await User.exists({ role: 'ADMIN' });
  if (exists) return;
  await User.create({
    name: 'FixFlow Admin',
    email: env.adminSeed.email,
    phone: '9000000000',
    passwordHash: await bcrypt.hash(env.adminSeed.password, 12),
    role: 'ADMIN',
  });
  // eslint-disable-next-line no-console
  console.log(`[boot] default admin created: ${env.adminSeed.email} (change the password!)`);
}

async function start() {
  await connectDB();
  await documentService.ensureDirs();
  await getSettings(); // creates default settings document on first run
  await ensureAdmin();

  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  // Background sweeper: offer timeouts, no-shows, retry of waiting requests (Sections 22, 28)
  let sweeping = false;
  const timer = setInterval(async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await technicianService.syncStaleBusy(); // clear stale BUSY statuses first so freed technicians can take waiting requests
      await assignmentService.sweep();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[sweeper]', err.message);
    } finally {
      sweeping = false;
    }
  }, env.sweeperIntervalSeconds * 1000);

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] FixFlow API listening on :${env.port} (${env.isProd ? 'production' : 'development'})${env.razorpay.mock ? ' | Razorpay MOCK mode' : ''}`);
  });

  const shutdown = (sig) => {
    // eslint-disable-next-line no-console
    console.log(`[server] ${sig} received, shutting down`);
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', err);
});

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] failed to start:', err);
  process.exit(1);
});
