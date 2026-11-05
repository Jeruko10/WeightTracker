// Exercises sections of the clipboard export: the training log and the deload cycle. The arrows
// match the app's above/below-range marks.
import { today, addDays, formatDate, daysBetween } from '../../lib/dates.js';
import { plural } from '../../lib/html.js';
import { rule, padLeft, padRight } from '../../shared/export-format.js';
import { EXPORT_ENTRIES, CHART_ENTRIES } from './constants.js';
import { state } from './state.js';
import {
  sortedDays, dayExercises, setLogs, repsState, formatWeight, logSides, machinesOf, activeMachine, archivedExercises,
  rangeText, exDoneToday, findById,
} from './selectors.js';
import { dailyTonnage } from './tonnage.js';
import { bodyweightLookup } from './bodyweight-source.js';
import { currentDeload, nextDeload, previousDeload, cyclePhase, cyclesText } from './deloads.js';

const MARK = { up: ' ↑', down: ' ↓', in: '' };

function asciiRange(s) {
  return s.min === s.max ? String(s.min) : s.min + '-' + s.max;
}

function sideText(l, s, side, sd, tag) {
  return (tag ? tag + ' ' : '') + padLeft(sd.reps, 3) + ' reps' + padRight(MARK[repsState(sd.reps, s)], 3) +
    '  ' + padLeft(formatWeight(sd.weight), 6) + ' kg';
}

function exportSet(out, x, s, k, track) {
  const hist = setLogs(x.id, s.id, track).reverse(), shown = hist.slice(0, EXPORT_ENTRIES);
  out.push('  Set ' + (k + 1) + ' · target ' + asciiRange(s) + ' reps' +
    (hist.length > EXPORT_ENTRIES ? ' · ' + hist.length + ' entries total' : ''));
  if (!shown.length) {
    out.push('    (no entries yet)');
    return;
  }
  shown.forEach((l) => {
    const sides = logSides(l);
    out.push('    ' + formatDate(l.date) + '   ' + sides.map((sd, i) =>
      sideText(l, s, i, sd, sides.length > 1 ? (i ? 'R' : 'L') : '')).join('   '));
  });
}

function exportExercise(out, x) {
  const flags = [x.unilateral ? 'unilateral' : '', x.bodyweight ? 'body weight' : ''].filter(Boolean);
  const title = x.name + '  (' + x.sets.length + ' ' + plural(x.sets.length, 'set') + (flags.length ? ', ' + flags.join(', ') : '') + ')';
  const active = activeMachine(x), tracks = machinesOf(x);
  // Active track first, then older ones that have entries.
  const shown = tracks.filter((t) => t === active || state.logs.some((l) => l.exerciseId === x.id && (l.machine || '') === t));
  shown.forEach((t, i) => {
    out.push(i === 0 && !t ? title : title + (t ? '  [' + t + ']' : '  [no label]'));
    x.sets.forEach((s, k) => exportSet(out, x, s, k, t));
    out.push('');
  });
}

function exportTraining() {
  if (!state.loaded) return ['(exercises are still loading)'];
  const days = sortedDays();
  if (!days.length) return ['(no training days yet)'];
  const out = [];
  days.forEach((d) => {
    const r = rule(d.name.length);
    out.push(r, d.name.toUpperCase(), r, '');
    const exs = dayExercises(d.id);
    if (!exs.length) {
      out.push('  (no exercises)', '');
      return;
    }
    exs.forEach((x) => exportExercise(out, x));
  });
  return out;
}

function exportDeload() {
  if (!state.loaded) return ['(still loading)'];
  const cur = currentDeload(), next = nextDeload();
  if (!cur && !next) return ['No deload recorded.'];
  const out = [];
  if (cur) {
    const n = daysBetween(cur.date, today()), prev = previousDeload(cur);
    out.push('Last deload started   ' + formatDate(cur.date) + '  (' + n + ' ' + plural(n, 'day') + ' ago)');
    out.push('Current status        ' + cyclePhase(cur).text);
    if (prev) {
      out.push('Previous deload       ' + formatDate(prev.date) + '  (' + cyclesText(daysBetween(prev.date, cur.date)) + ' between deloads)');
    }
  }
  if (next) out.push('Next deload planned   ' + formatDate(next.date));
  return out;
}

export function exportSections() {
  return { training: exportTraining(), deload: exportDeload(), entries: EXPORT_ENTRIES };
}

// ── Structured data for the HTML report ───────────────────────────────────────
function trackReport(x, track, lookup) {
  const logs = state.logs.filter((l) => l.exerciseId === x.id && (l.machine || '') === track);
  const days = dailyTonnage(x, track, lookup);
  const lastDate = logs.reduce((m, l) => (l.date > m ? l.date : m), '');
  return {
    label: track, active: track === activeMachine(x), entries: logs.length, lastDate,
    tonnage: days.slice(-CHART_ENTRIES),
    estimated: !!x.bodyweight && !!lookup.firstDate && days.some((d) => d.date < lookup.firstDate),
    sets: x.sets.map((s, k) => ({
      k, range: rangeText(s),
      rows: setLogs(x.id, s.id, track).slice(-EXPORT_ENTRIES).reverse().map((l) => ({
        date: l.date,
        sides: logSides(l).map((sd) => ({ reps: sd.reps, weight: sd.weight, state: repsState(sd.reps, s) })),
      })),
    })),
  };
}

function exerciseReport(x, lookup) {
  const active = activeMachine(x);
  const tracks = machinesOf(x)
    .filter((t) => t === active || state.logs.some((l) => l.exerciseId === x.id && (l.machine || '') === t))
    .map((t) => trackReport(x, t, lookup));
  return {
    name: x.name, unilateral: !!x.unilateral, bodyweight: !!x.bodyweight, machine: active,
    doneToday: exDoneToday(x), setCount: x.sets.length, tracks,
    bodyweightMissing: !!x.bodyweight && !lookup.firstDate,
  };
}

/** Training days with their exercises, activity and deload status; null while still loading. */
export function exercisesReport() {
  if (!state.loaded) return null;
  const lookup = bodyweightLookup();
  const t = today(), dates = Array.from(new Set(state.logs.map((l) => l.date))).sort();
  const cur = currentDeload(), next = nextDeload(), prev = cur ? previousDeload(cur) : null;
  return {
    days: sortedDays().map((d) => ({ name: d.name, exercises: dayExercises(d.id).map((x) => exerciseReport(x, lookup)) })),
    archivedCount: archivedExercises().length,
    sessionsLast7: dates.filter((d) => d >= addDays(t, -6)).length,
    lastWorkout: dates.length ? dates[dates.length - 1] : null,
    deload: {
      phase: cur ? cyclePhase(cur) : null,
      lastDate: cur ? cur.date : null,
      daysAgo: cur ? daysBetween(cur.date, t) : null,
      gapBefore: cur && prev ? daysBetween(prev.date, cur.date) : null,
      nextDate: next ? next.date : null,
    },
  };
}

const DAY_REPORT_SESSIONS = 6;

/**
 * One training day, trimmed for a one-screen summary: per exercise, the tonnage of its last
 * sessions and only the most recent entry of each set (all on the exercise's current machine).
 * Null while loading or if the day doesn't exist.
 */
export function dayReport(dayId) {
  const day = findById(state.days, dayId);
  if (!state.loaded || !day) return null;
  const lookup = bodyweightLookup();
  return {
    name: day.name,
    exercises: dayExercises(dayId).map((x) => {
      const r = exerciseReport(x, lookup), t = r.tracks.find((tr) => tr.active) || r.tracks[0];
      const sets = t ? t.sets.map((s) => ({ k: s.k, row: s.rows[0] || null })) : [];
      const dates = sets.filter((s) => s.row).map((s) => s.row.date).sort();
      return {
        name: x.name, unilateral: r.unilateral, bodyweight: r.bodyweight, machine: r.machine,
        tonnage: t ? t.tonnage.slice(-DAY_REPORT_SESSIONS).map((d) => ({ date: d.date, total: d.total })) : [],
        sets, lastDate: dates.length ? dates[dates.length - 1] : null,
      };
    }),
  };
}
