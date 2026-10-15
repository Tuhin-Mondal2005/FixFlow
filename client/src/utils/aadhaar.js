// Aadhaar number helpers (same rules as the server: 12 digits, first digit 2-9, Verhoeff check digit).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const checksumOk = (digits) => {
  let c = 0;
  digits.split('').reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
  return c === 0;
};

/** Groups of four for display: "1234 5678 9012" */
export const formatAadhaar = (v) => String(v || '').replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

/** Returns an error message, or '' when the number is acceptable. */
export function aadhaarError(v) {
  const n = String(v || '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(n)) return 'Enter the 12-digit Aadhaar number';
  if (!/^[2-9]/.test(n)) return 'Aadhaar numbers do not start with 0 or 1';
  if (!checksumOk(n)) return 'This Aadhaar number is not valid. Please check each digit.';
  return '';
}
