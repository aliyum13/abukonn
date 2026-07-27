// Class times come from the API as "HH:MM" (24-hour) once normalised, but older
// rows may still be "2:00 PM". Parse both so the timetable can tell what has
// already finished. Mirrors backend/src/lib/time.js.

export function parseTimeToMinutes(value?: string | null): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase().replace(/\./g, '') : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return null;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23) return null;

  return hours * 60 + minutes;
}

/** Minutes since midnight, right now. */
export function nowInMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export type ClassTiming = 'ended' | 'ongoing' | 'upcoming' | 'unknown';

/**
 * Where a class sits relative to the current time. Only meaningful for today —
 * the week view shows every day, so callers must not apply this there.
 */
export function classTiming(startTime?: string | null, endTime?: string | null, now = nowInMinutes()): ClassTiming {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  // With no end time, treat the class as ended once its start has passed.
  if (end === null) {
    if (start === null) return 'unknown';
    return now > start ? 'ended' : 'upcoming';
  }
  if (now >= end) return 'ended';
  if (start !== null && now >= start) return 'ongoing';
  return 'upcoming';
}

/** Display a stored time in a friendly 12-hour form ("14:00" -> "2:00 PM"). */
export function formatTime(value?: string | null): string {
  const mins = parseTimeToMinutes(value);
  if (mins === null) return value ? String(value) : '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// ── chat message timestamps (ISO datetime strings, distinct from the
// "14:00"-style class-schedule strings formatTime() above handles) ──────────

/** "2:30 PM" from an ISO created_at timestamp, viewer's local time. */
export function formatMessageTime(isoString: string): string {
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

/** True if two ISO timestamps fall on the same local calendar day. */
export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Date-separator label for a chat thread: "Today", "Yesterday", or a short date. */
export function formatDateSeparator(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-NG', opts);
}
