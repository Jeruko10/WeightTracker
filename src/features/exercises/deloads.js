// A deload is the date it starts; the current cycle runs from the latest start on or before today (a future start is planned, not active).
import { today, daysBetween } from '../../lib/dates.js';
import { plural } from '../../lib/html.js';
import { getCycleLength } from '../../shared/settings.js';
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

// The first cycle after a start is the deload cycle itself; after it, training cycles are counted.
// A cycle is as many days as the user set in the profile menu (7 by default).
export function cyclePhase(d) {
  const n = daysBetween(d.date, today()), len = getCycleLength();
  return n < len
    ? { isDeload: true, text: `Deload cycle, day ${n + 1} of ${len}` }
    : { isDeload: false, text: 'Cycle ' + (Math.floor((n - len) / len) + 1) + ' after deload' };
}

export function cyclesText(days) {
  const len = getCycleLength(), c = days / len;
  return (days % len === 0 ? String(c) : c.toFixed(1)) + ' ' + plural(c, 'cycle');
}
