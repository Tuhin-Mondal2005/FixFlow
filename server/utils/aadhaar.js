'use strict';

/*
 * Aadhaar number helpers.
 * An Aadhaar number is 12 digits, never starts with 0 or 1, and its last digit is a Verhoeff
 * check digit. The check catches typing mistakes. It does NOT prove the number belongs to the person:
 * that is what the uploaded Aadhaar document is for.
 */

// Verhoeff tables (dihedral group D5 multiplication, permutation and inverse)
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** True when a full digit string (check digit included) passes the Verhoeff test. */
function checksumOk(digits) {
  let c = 0;
  digits.split('').reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]];
  });
  return c === 0;
}

/** The check digit to append to an 11-digit string. */
function checkDigitFor(elevenDigits) {
  let c = 0;
  elevenDigits.split('').reverse().forEach((ch, i) => {
    c = D[c][P[(i + 1) % 8][Number(ch)]];
  });
  return String(INV[c]);
}

/** Build a 12-digit number from 11 digits (used for seed / demo data). */
const withCheckDigit = (elevenDigits) => elevenDigits + checkDigitFor(elevenDigits);

/** Strip the spaces and dashes people type between groups of four. */
const normalizeAadhaar = (value) => String(value || '').replace(/[\s-]/g, '');

/** Full validity: 12 digits, first digit 2-9, Verhoeff check passes. */
const isValidAadhaar = (value) => typeof value === 'string' && /^[2-9]\d{11}$/.test(value) && checksumOk(value);

module.exports = { checksumOk, checkDigitFor, withCheckDigit, normalizeAadhaar, isValidAadhaar };
