// Front-end validation is only for fast feedback. The server validates everything again with the same rules.
export const validateEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()) ? '' : 'Enter a valid email');
export const validatePhone = (v) => (/^[6-9]\d{9}$/.test((v || '').trim()) ? '' : 'Enter a valid 10-digit Indian mobile number');
export const validatePassword = (v) => {
  if (!v || v.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(v)) return 'Password must contain a letter';
  if (!/\d/.test(v)) return 'Password must contain a number';
  return '';
};

export const MAX_FILE = 5 * 1024 * 1024;
export const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg'];
export function validateFile(file, { imageOnly = false } = {}) {
  if (!file) return 'Required';
  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = imageOnly ? ['png', 'jpg', 'jpeg'] : ALLOWED_EXT;
  if (!allowed.includes(ext)) return `Only ${allowed.join(', ').toUpperCase()} files are allowed`;
  if (file.size > MAX_FILE) return 'File is larger than 5 MB';
  return '';
}
