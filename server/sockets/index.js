'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Technician = require('../models/Technician');
const ServiceRequest = require('../models/ServiceRequest');
const { IN_PROGRESS_STATUSES } = require('../config/constants');

let io = null;

/**
 * Socket.IO real-time layer (Section 25).
 * Rooms:  user:<userId>        private notifications + request updates for that person
 *         role:ADMIN           dispatcher feed
 *         request:<requestId>  live tracking of one job (customer, assigned technician, admin only)
 * Events: notification, request:update, technician:location
 */
function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.id).select('+tokenVersion');
      if (!user || !user.isActive || (user.tokenVersion || 0) !== (payload.tv || 0)) return next(new Error('Invalid session'));
      socket.user = { id: user._id.toString(), role: user.role, name: user.name };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);
    if (role === 'ADMIN') socket.join('role:ADMIN');

    // Join a tracking room - authorised against the database, never trusting the client.
    socket.on('request:join', async (requestId, ack) => {
      try {
        const reqDoc = await ServiceRequest.findById(requestId).select('customerId technicianId');
        if (!reqDoc) throw new Error('Not found');
        let allowed = role === 'ADMIN' || reqDoc.customerId.toString() === id;
        if (!allowed && role === 'TECHNICIAN' && reqDoc.technicianId) {
          const tech = await Technician.findOne({ userId: id }).select('_id');
          allowed = !!tech && tech._id.toString() === reqDoc.technicianId.toString();
        }
        if (!allowed) throw new Error('Forbidden');
        socket.join(`request:${requestId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, message: e.message });
      }
    });

    socket.on('request:leave', (requestId) => socket.leave(`request:${requestId}`));

    // Technician streams position while travelling / on site (throttled client-side).
    socket.on('technician:location', async (payload, ack) => {
      try {
        if (role !== 'TECHNICIAN') throw new Error('Forbidden');
        const lat = Number(payload && payload.latitude);
        const lng = Number(payload && payload.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Invalid coordinates');
        const tech = await Technician.findOneAndUpdate(
          { userId: id },
          { $set: { liveLocation: { latitude: lat, longitude: lng, updatedAt: new Date() } } },
          { new: true }
        );
        if (!tech) throw new Error('Technician not found');
        const jobs = await ServiceRequest.find({ technicianId: tech._id, status: { $in: IN_PROGRESS_STATUSES } }).select('_id');
        for (const j of jobs) {
          io.to(`request:${j._id}`).emit('technician:location', {
            requestId: j._id.toString(),
            latitude: lat,
            longitude: lng,
            at: new Date().toISOString(),
          });
        }
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, message: e.message });
      }
    });
  });

  return io;
}

const getIO = () => io;

function emitToUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}
function emitToAdmins(event, payload) {
  if (io) io.to('role:ADMIN').emit(event, payload);
}
function emitToRequest(requestId, event, payload) {
  if (io && requestId) io.to(`request:${requestId}`).emit(event, payload);
}

module.exports = { initSockets, getIO, emitToUser, emitToAdmins, emitToRequest };
