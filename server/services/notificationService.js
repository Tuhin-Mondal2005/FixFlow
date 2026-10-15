'use strict';

const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser, emitToAdmins, emitToRequest } = require('../sockets');

/** Persist a notification and push it live over Socket.IO (Section 26). Never throws into business flows. */
async function notify(userId, { title, message, type = 'INFO', data = {} }) {
  if (!userId) return null;
  try {
    const doc = await Notification.create({ userId, title, message, type, data });
    emitToUser(userId.toString(), 'notification', doc.toObject());
    return doc;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed', err.message);
    return null;
  }
}

async function notifyAdmins(payload) {
  try {
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
    await Promise.all(admins.map((a) => notify(a._id, payload)));
    emitToAdmins('admin:event', { type: payload.type, ...payload.data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifyAdmins] failed', err.message);
  }
}

/**
 * Push a lightweight "request changed" event to everyone who watches that request:
 * the customer, the assigned technician's user, admins and the tracking room.
 */
function broadcastRequestUpdate(request, technicianUserId) {
  const payload = {
    requestId: request._id.toString(),
    requestNumber: request.requestNumber,
    status: request.status,
    technicianId: request.technicianId ? request.technicianId.toString() : null,
    updatedAt: new Date().toISOString(),
  };
  emitToUser(request.customerId.toString(), 'request:update', payload);
  if (technicianUserId) emitToUser(technicianUserId.toString(), 'request:update', payload);
  emitToAdmins('request:update', payload);
  emitToRequest(request._id.toString(), 'request:update', payload);
}

module.exports = { notify, notifyAdmins, broadcastRequestUpdate };
