'use strict';

const ApiError = require('../utils/ApiError');

/**
 * validate(schema, 'body' | 'query' | 'params')
 * Backend validation is the source of truth - the frontend is never trusted. Unknown keys are stripped.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(ApiError.badRequest(details[0] ? `${details[0].field ? details[0].field + ': ' : ''}${details[0].message}` : 'Invalid input', details));
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
