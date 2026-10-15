'use strict';

const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

/**
 * Files are held in memory first so that their real content (magic bytes) can be validated and
 * the sensitive ones encrypted BEFORE anything touches the disk. Limits: 5 MB per file, max 6 files.
 */
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest('Only PDF, PNG and JPG files are allowed'));
  }
  cb(null, true);
};

const technicianUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 40 },
}).fields([
  { name: 'aadhaar', maxCount: 1 },
  { name: 'qualification', maxCount: 4 },
  { name: 'photo', maxCount: 1 },
]);

module.exports = { technicianUpload };
