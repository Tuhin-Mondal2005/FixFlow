'use strict';

/** Mask an Aadhaar number: only the last four digits are ever kept or shown. */
const maskAadhaar = (last4) => (last4 ? `XXXX-XXXX-${last4}` : 'Not provided');

const maskPhone = (phone = '') => (phone.length >= 4 ? `${'X'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone);

/** Escape user supplied text before putting it in a RegExp (search boxes). */
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { maskAadhaar, maskPhone, escapeRegex };
