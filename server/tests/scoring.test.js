'use strict';

// Run with: npm test   (uses Node's built-in test runner - no extra packages, no database needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeScore, locationFactor, workloadFactor, ratingFactor, experienceFactor, overlaps,
} = require('../services/scoring');
const { haversineKm } = require('../utils/geo');
const { detectMime } = require('../utils/fileValidation');
const { runExclusive } = require('../utils/mutex');

// Weights exactly as in the brief: 40 / 25 / 20 / 10 / 5 (experience off => pure suggested formula)
const BRIEF = { skill: 40, availability: 25, location: 20, workload: 10, rating: 5, experience: 0 };

test('score follows the weighted formula from the brief', () => {
  const amit = { skill: 100, availability: 100, location: 95, workload: 90, rating: 96, experience: 100 };
  // (40*100 + 25*100 + 20*95 + 10*90 + 5*96) / 100 = 97.8
  assert.equal(computeScore(amit, BRIEF), 97.8);
});

test('better technician always outranks the weaker one', () => {
  const amit = { skill: 100, availability: 100, location: 95, workload: 90, rating: 96, experience: 50 };
  const rahul = { skill: 100, availability: 80, location: 70, workload: 90, rating: 92, experience: 30 };
  assert.ok(computeScore(amit, BRIEF) > computeScore(rahul, BRIEF));
});

test('weights are normalised: doubling every weight does not change the score', () => {
  const f = { skill: 100, availability: 60, location: 40, workload: 80, rating: 90, experience: 20 };
  const w1 = { skill: 40, availability: 25, location: 20, workload: 10, rating: 5, experience: 5 };
  const w2 = Object.fromEntries(Object.entries(w1).map(([k, v]) => [k, v * 2]));
  assert.equal(computeScore(f, w1), computeScore(f, w2));
});

test('all-zero weights give 0 instead of NaN', () => {
  const zero = { skill: 0, availability: 0, location: 0, workload: 0, rating: 0, experience: 0 };
  assert.equal(computeScore({ skill: 100 }, zero), 0);
});

test('closer technicians score higher on location; out of radius is 0', () => {
  assert.ok(locationFactor(1.2, 15) > locationFactor(5.8, 15));
  assert.equal(locationFactor(0, 15), 100);
  assert.equal(locationFactor(15, 15), 0);
  assert.equal(locationFactor(40, 15), 0);
});

test('workload balancing: fewer active jobs score higher', () => {
  assert.ok(workloadFactor(0, 8) > workloadFactor(1, 8));
  assert.ok(workloadFactor(1, 8) > workloadFactor(10, 8));
  assert.equal(workloadFactor(0, 8), 100);
  assert.equal(workloadFactor(8, 8), 0);
});

test('two equally good technicians: the one with the lighter workload wins (fairness)', () => {
  const base = { skill: 100, availability: 100, location: 80, rating: 90, experience: 50 };
  const busy = computeScore({ ...base, workload: workloadFactor(10, 12) }, BRIEF);
  const idle = computeScore({ ...base, workload: workloadFactor(0, 12) }, BRIEF);
  assert.ok(idle > busy);
});

test('rating factor: newcomers are neutral, reviewed technicians use their average', () => {
  assert.equal(ratingFactor(0, 0), 75);
  assert.equal(ratingFactor(4.8, 237), 96);
  assert.equal(ratingFactor(5, 1), 100);
});

test('experience factor caps at 10 years', () => {
  assert.equal(experienceFactor(0), 0);
  assert.equal(experienceFactor(5), 50);
  assert.equal(experienceFactor(25), 100);
});

test('haversine: Garia -> Jadavpur is a few km, identical points are 0', () => {
  assert.equal(haversineKm(22.4639, 88.3947, 22.4639, 88.3947), 0);
  const d = haversineKm(22.4639, 88.3947, 22.5150, 88.3640);
  assert.ok(d > 5 && d < 8, `unexpected distance ${d}`);
  // known reference: Kolkata -> Delhi is roughly 1,300 km
  const kd = haversineKm(22.5726, 88.3639, 28.6139, 77.209);
  assert.ok(kd > 1250 && kd < 1350, `unexpected distance ${kd}`);
});

test('time windows overlap detection', () => {
  const t = (m) => new Date(2026, 9, 10, 10, m);
  assert.equal(overlaps(t(0), t(60), t(30), t(90)), true);
  assert.equal(overlaps(t(0), t(60), t(60), t(120)), false); // back-to-back is allowed
  assert.equal(overlaps(t(0), t(60), t(61), t(120)), false);
});

test('file validation checks real content, not just the extension', () => {
  const pdf = Buffer.from('%PDF-1.4 hello');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  assert.equal(detectMime(pdf, '.pdf'), 'application/pdf');
  assert.equal(detectMime(png, '.png'), 'image/png');
  assert.equal(detectMime(jpg, '.jpg'), 'image/jpeg');
  // an .exe renamed to .pdf must be rejected
  assert.equal(detectMime(Buffer.from('MZ\x90\x00 not a pdf'), '.pdf'), null);
  // extension / content mismatch
  assert.equal(detectMime(pdf, '.png'), null);
  // profile photos must be images
  assert.equal(detectMime(pdf, '.pdf', { imagesOnly: true }), null);
});

test('mutex serialises concurrent tasks (no double assignment)', async () => {
  let running = 0;
  let maxRunning = 0;
  const order = [];
  const task = (n) => runExclusive('k', async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 10));
    order.push(n);
    running -= 1;
  });
  await Promise.all([task(1), task(2), task(3), task(4)]);
  assert.equal(maxRunning, 1);
  assert.deepEqual(order, [1, 2, 3, 4]);
});

test('mutex keeps working after a task throws', async () => {
  await assert.rejects(runExclusive('k2', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await runExclusive('k2', async () => 'still ok'), 'still ok');
});
