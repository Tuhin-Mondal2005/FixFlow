'use strict';

const crypto = require('crypto');
const env = require('../config/env');

// AES-256-GCM, key derived from DOC_ENCRYPTION_KEY. File layout: [12 byte IV][16 byte tag][ciphertext]
const key = crypto.scryptSync(env.docEncryptionKey, 'fixflow-doc-salt', 32);

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

function decryptBuffer(payload) {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

const randomName = () => crypto.randomBytes(24).toString('hex');

/** Encrypt a short secret string (e.g. the Aadhaar number). Returns base64 text safe to store in MongoDB. */
function encryptText(text) {
  return encryptBuffer(Buffer.from(String(text), 'utf8')).toString('base64');
}

function decryptText(payload) {
  return decryptBuffer(Buffer.from(payload, 'base64')).toString('utf8');
}

module.exports = { encryptBuffer, decryptBuffer, encryptText, decryptText, randomName };
