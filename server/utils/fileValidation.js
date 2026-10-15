'use strict';

// Validate the REAL content of an upload (magic bytes), not just the extension / client MIME type.
const SIGNATURES = [
  { mime: 'application/pdf', ext: ['.pdf'], test: (b) => b.length > 4 && b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: ['.png'], test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: ['.jpg', '.jpeg'], test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

const IMAGE_ONLY = new Set(['image/png', 'image/jpeg']);

/** Returns the detected mime type or null if the buffer is not an allowed file. */
function detectMime(buffer, ext, { imagesOnly = false } = {}) {
  const lower = (ext || '').toLowerCase();
  for (const sig of SIGNATURES) {
    if (imagesOnly && !IMAGE_ONLY.has(sig.mime)) continue;
    if (sig.ext.includes(lower) && sig.test(buffer)) return sig.mime;
  }
  return null;
}

module.exports = { detectMime };
