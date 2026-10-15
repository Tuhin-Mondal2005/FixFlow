'use strict';

const AuditLog = require('../models/AuditLog');

/** Record an important admin action (Section 66). Failures never break the business operation. */
async function audit(req, action, entityType, entityId, summary, details = {}) {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      adminName: req.user.name,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      details,
      ip: req.ip,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed', err.message);
  }
}

module.exports = { audit };
