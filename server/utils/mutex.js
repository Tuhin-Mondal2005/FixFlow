'use strict';

/**
 * Tiny in-process FIFO mutex. The assignment engine runs inside it so two requests can never
 * be matched to the same technician slot at the same time.
 * (Single Node instance. For horizontal scaling replace with a Redis/Mongo distributed lock.)
 */
const tails = new Map();

function runExclusive(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

module.exports = { runExclusive };
