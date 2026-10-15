'use strict';

const env = require('../config/env');

/** "2026-10-10" + "10:00" -> Date, interpreted in the business timezone (default IST +05:30). */
function combineDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00${env.tzOffset}`);
}

/** Start of the given calendar day in the business timezone. */
function startOfBusinessDay(dateStr) {
  return new Date(`${dateStr}T00:00:00${env.tzOffset}`);
}

/** "HH:mm" -> minutes since midnight */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight of a Date, expressed in the business timezone. */
function minutesOfDayInBusinessTz(date) {
  const sign = env.tzOffset.startsWith('-') ? -1 : 1;
  const [oh, om] = env.tzOffset.slice(1).split(':').map(Number);
  const offsetMin = sign * (oh * 60 + om);
  const local = new Date(date.getTime() + offsetMin * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Today's date string (YYYY-MM-DD) in the business timezone. */
function todayInBusinessTz(now = new Date()) {
  const sign = env.tzOffset.startsWith('-') ? -1 : 1;
  const [oh, om] = env.tzOffset.slice(1).split(':').map(Number);
  const local = new Date(now.getTime() + sign * (oh * 60 + om) * 60000);
  return local.toISOString().slice(0, 10);
}

/** Start boundaries (as real instants) for "today", "this week (Mon)", "this month" in the business TZ. */
function periodStarts(now = new Date()) {
  const today = todayInBusinessTz(now);
  const dayStart = startOfBusinessDay(today);
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const weekStart = new Date(dayStart.getTime() - dow * 86400000);
  const monthStart = startOfBusinessDay(`${today.slice(0, 7)}-01`);
  return { dayStart, weekStart, monthStart };
}

const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60000);

module.exports = {
  combineDateTime,
  startOfBusinessDay,
  toMinutes,
  minutesOfDayInBusinessTz,
  todayInBusinessTz,
  periodStarts,
  addMinutes,
};
