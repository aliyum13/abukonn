'use strict';

/**
 * Timetable times arrive in whatever shape a class rep or a CSV happens to use:
 * "10:00 AM", "2:00 PM", "14:00", "9:00", "9am". Storing them raw meant sorting
 * treated "2:00 PM" as 02:00, so afternoon classes sorted before morning ones.
 *
 * Everything that compares or orders a class time goes through here.
 */

/**
 * Parse a time string to minutes since midnight. Handles 12-hour (with or
 * without a space before AM/PM) and 24-hour input. Returns null when the value
 * can't be understood, so callers can decide how to treat it rather than
 * silently getting midnight.
 */
function parseTimeToMinutes(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase().replace(/\./g, '') : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (minutes > 59) return null;

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  // Without a meridiem we treat it as already 24-hour.
  if (hours > 23) return null;

  return hours * 60 + minutes;
}

/** Normalise any accepted input to 24-hour "HH:MM" for storage. */
function normalizeTime(value) {
  const mins = parseTimeToMinutes(value);
  if (mins === null) return value === null || value === undefined ? null : String(value).trim() || null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Sort comparator for objects with a start_time. Unparseable times sort last
 * rather than jumping to the top as midnight.
 */
function byStartTime(a, b) {
  const am = parseTimeToMinutes(a && a.start_time);
  const bm = parseTimeToMinutes(b && b.start_time);
  if (am === null && bm === null) return 0;
  if (am === null) return 1;
  if (bm === null) return -1;
  return am - bm;
}

module.exports = { parseTimeToMinutes, normalizeTime, byStartTime };
