// Deload cycle queries. A deload is recorded as the date it starts. The current cycle runs from
// the latest start on or before today; a start in the future is shown as planned, not active.
import { today, daysBetween } from '../../lib/dates.js';
import { plural } from '../../lib/html.js';
import { state } from './state.js';

export function deloadsNewestFirst() {
  return state.deloads.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function currentDeload() {
  const t = today();
  return deloadsNewestFirst().find((d) => d.date <= t) || null;
}

export function nextDeload() {
  const t = today(), upcoming = deloadsNewestFirst().filter((d) => d.date > t);
  return upcoming.length ? upcoming[upcoming.length - 1] : null;
}

export function previousDeload(d) {
  const asc = deloadsNewestFirst().reverse(), i = asc.indexOf(d);
  return i > 0 ? asc[i - 1] : null;
}

// Day 0–6 after a start is the deload week itself; from day 7 on, training weeks are counted.
export function cyclePhase(d) {
  const n = daysBetween(d.date, today());
  return n < 7
    ? { deloadWeek: true, text: 'Deload week, day ' + (n + 1) }
    : { deloadWeek: false, text: 'Week ' + (Math.floor((n - 7) / 7) + 1) + ' after deload' };
}

/** 14 → '2 weeks', 10 → '1.4 weeks'. */
export function weeksText(days) {
  const w = days / 7;
  return (days % 7 === 0 ? String(w) : w.toFixed(1)) + ' ' + plural(w, 'week');
}
