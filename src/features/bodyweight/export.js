// Bodyweight section of the clipboard export. Uses the same averages and data threshold as the
// Overview stats, so the two always agree.
import { formatDate, today, daysBetween, weekKey } from '../../lib/dates.js';
import { padLeft } from '../../shared/export-format.js';
import { state } from './state.js';
import { computeTrend, windowAvg } from './stats.js';
import { hasTimeline, goalStartWeight } from './goal-plan.js';

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

/**
 * Structured data for the HTML report (null when there is nothing to report):
 * weigh-ins with their 7-day average, a weekly summary and the goal with where the user stands.
 * Numbers come from the same trend maths as the Overview, so the report agrees with the app.
 */
export function bodyweightReport() {
  const { entries, goal } = state;
  const n = entries.length;
  if (!n && !hasTimeline(goal)) return null;
  const trend = n ? computeTrend(entries) : null;
  const first = n ? entries[0].date : null;
  const points = entries.map((e) => ({
    date: e.date, weight: e.weight, avg: windowAvg(trend.series, e.date, 7, first),
  }));
  const weeks = {};
  entries.forEach((e) => { (weeks[weekKey(e.date)] = weeks[weekKey(e.date)] || []).push(e.weight); });
  const weekly = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0])).map(([key, ws]) => ({
    key, avg: ws.reduce((a, b) => a + b, 0) / ws.length, n: ws.length,
  }));
  return {
    n, points, weekly,
    latest: n ? entries[n - 1] : null,
    curAvg: trend ? trend.curAvg : null,
    prevAvg: trend ? trend.prevAvg : null,
    goal: hasTimeline(goal) ? goalStatus(goal, entries, trend) : null,
  };
}

/** Where the user stands against the goal: progress, time elapsed and the gap to the plan. */
function goalStatus(goal, entries, trend) {
  const startWeight = goalStartWeight(goal, entries) ?? (entries.length ? entries[0].weight : null);
  const isBulk = goal.isBulk !== undefined ? goal.isBulk : startWeight !== null && goal.weight > startWeight;
  const out = { target: Number(goal.weight), start: goal.start, end: goal.date, pace: goal.pace || null, isBulk, startWeight };
  if (!trend || startWeight === null) return out;
  const total = goal.weight - startWeight, done = trend.curAvg - startWeight;
  const totalDays = Math.max(1, daysBetween(goal.start, goal.date));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(goal.start, today())));
  out.progress = total ? Math.min(1, Math.max(0, done / total)) : 1;
  out.timeProgress = elapsed / totalDays;
  // Positive = ahead of the straight-line plan, whichever direction the goal goes.
  const planned = startWeight + total * out.timeProgress;
  out.aheadKg = isBulk ? trend.curAvg - planned : planned - trend.curAvg;
  out.reached = isBulk ? trend.curAvg >= goal.weight : trend.curAvg <= goal.weight;
  out.pastDue = !out.reached && today() > goal.date;
  out.remainingKg = Math.abs(goal.weight - trend.curAvg);
  return out;
}
