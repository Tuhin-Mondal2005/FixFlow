'use strict';

const fs = require('fs/promises');
const path = require('path');
const { encryptBuffer, decryptBuffer, randomName } = require('../utils/crypto');
const { detectMime } = require('../utils/fileValidation');
const ApiError = require('../utils/ApiError');

// PRIVATE storage: never mounted as static, never reachable by URL. Files inside are AES-256-GCM encrypted.
const PRIVATE_DIR = path.join(__dirname, '..', 'private_uploads');
// PUBLIC storage: profile photos only (not sensitive).
const PUBLIC_PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'photos');

async function ensureDirs() {
  await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(PUBLIC_PHOTO_DIR, { recursive: true });
}

/** Validate real content and store a sensitive document encrypted. Returns the metadata for the DB. */
async function storePrivateDocument(file, { imagesOnly = false } = {}) {
  await ensureDirs();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = detectMime(file.buffer, ext, { imagesOnly });
  if (!mime) throw ApiError.badRequest(`"${file.originalname}" is not a valid PDF, PNG or JPG file`);
  const storedName = `${randomName()}.enc`;
  await fs.writeFile(path.join(PRIVATE_DIR, storedName), encryptBuffer(file.buffer), { mode: 0o600 });
  return {
    storedName,
    originalName: path.basename(file.originalname).slice(0, 120),
    mimeType: mime,
    size: file.size,
    uploadedAt: new Date(),
  };
}

/** Profile photo - image only, stored under a random name in the public photos folder. */
async function storeProfilePhoto(file) {
  await ensureDirs();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = detectMime(file.buffer, ext, { imagesOnly: true });
  if (!mime) throw ApiError.badRequest('Profile photo must be a valid PNG or JPG image');
  const name = `${randomName().slice(0, 32)}${mime === 'image/png' ? '.png' : '.jpg'}`;
  await fs.writeFile(path.join(PUBLIC_PHOTO_DIR, name), file.buffer);
  return `/uploads/photos/${name}`;
}

/** Decrypt a stored document. Only called from admin-guarded controllers. */
async function readPrivateDocument(doc) {
  const safe = path.basename(doc.storedName); // defence against path traversal
  const payload = await fs.readFile(path.join(PRIVATE_DIR, safe));
  return decryptBuffer(payload);
}

async function deletePrivateDocument(doc) {
  if (!doc || !doc.storedName) return;
  try {
    await fs.unlink(path.join(PRIVATE_DIR, path.basename(doc.storedName)));
  } catch {
    /* already gone */
  }
}

async function deletePublicPhoto(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/photos/')) return;
  try {
    await fs.unlink(path.join(PUBLIC_PHOTO_DIR, path.basename(publicPath)));
  } catch {
    /* ignore */
  }
}

module.exports = {
  PRIVATE_DIR,
  PUBLIC_PHOTO_DIR,
  ensureDirs,
  storePrivateDocument,
  storeProfilePhoto,
  readPrivateDocument,
  deletePrivateDocument,
  deletePublicPhoto,
};
