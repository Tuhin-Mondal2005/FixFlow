'use strict';

/**
 * Minimal NoSQL-injection guard: strips any key beginning with "$" or containing "." from
 * req.body / req.query / req.params (e.g. { "email": { "$gt": "" } }).
 */
function clean(obj) {
  if (Array.isArray(obj)) return obj.map(clean);
  if (obj && typeof obj === 'object' && !(obj instanceof Date) && !Buffer.isBuffer(obj)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return obj;
}

module.exports = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  if (req.query) {
    const cleaned = clean(req.query);
    // Express 4 allows reassigning req.query
    Object.defineProperty(req, 'query', { value: cleaned, writable: true, configurable: true, enumerable: true });
  }
  next();
};
