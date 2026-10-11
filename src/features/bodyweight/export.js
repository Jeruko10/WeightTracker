// Bodyweight section of the clipboard export. Uses the same averages and data threshold as the
// Overview stats, so the two always agree.
import { formatDate } from '../../lib/dates.js';
import { padLeft } from '../../shared/export-format.js';
import { state } from './state.js';
import { computeTrend } from './stats.js';
import { hasTimeline } from './goal-plan.js';

const EXPORT_WEIGH_INS = 10;

/** Plain-text lines, or null when there is nothing to report. */
export function exportBodyweight() {
  const { entries, goal } = state;
  const n = entries.length, out = [];
  if (!n && !hasTimeline(goal)) return null;
  if (n) {
    const last = entries[n - 1], trend = computeTrend(entries);
    out.push('Latest weigh-in       ' + last.weight.toFixed(1) + ' kg  (' + formatDate(last.date) + ')');
    out.push('7-day average         ' + trend.curAvg.toFixed(1) + ' kg');
    if (trend.prevAvg !== null) {
      const d = trend.curAvg - trend.prevAvg;
      out.push('Previous 7 days       ' + trend.prevAvg.toFixed(1) + ' kg  (' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' kg)');
    }
  }
  if (hasTimeline(goal)) {
    out.push('Goal                  ' + (goal.isBulk ? 'Bulk' : 'Cut') + ' to ' + Number(goal.weight).toFixed(1) +
      ' kg by ' + formatDate(goal.date) + (goal.pace ? '  (' + (goal.isBulk ? '+' : '-') + goal.pace + ' kg/wk)' : ''));
  }
  if (n) {
    out.push('', 'Last ' + Math.min(n, EXPORT_WEIGH_INS) + ' weigh-ins, newest first');
    entries.slice(-EXPORT_WEIGH_INS).reverse().forEach((e) => {
      out.push('    ' + formatDate(e.date) + '   ' + padLeft(e.weight.toFixed(1), 6) + ' kg');
    });
  }
  return out;
}
