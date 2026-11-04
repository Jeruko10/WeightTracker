// Exercises sections of the clipboard export: the training log and the deload cycle. The arrows
// match the app's above/below-range marks.
import { today, formatDate, daysBetween } from '../../lib/dates.js';
import { plural } from '../../lib/html.js';
import { rule, padLeft, padRight } from '../../shared/export-format.js';
import { EXPORT_ENTRIES } from './constants.js';
import { state } from './state.js';
import {
  sortedDays, dayExercises, setLogs, repsState, formatWeight, logSides, machinesOf, activeMachine,
} from './selectors.js';
import { currentDeload, nextDeload, previousDeload, cyclePhase, weeksText } from './deloads.js';

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
      out.push('Previous deload       ' + formatDate(prev.date) + '  (' + weeksText(daysBetween(prev.date, cur.date)) + ' between deloads)');
    }
  }
  if (next) out.push('Next deload planned   ' + formatDate(next.date));
  return out;
}

export function exportSections() {
  return { training: exportTraining(), deload: exportDeload(), entries: EXPORT_ENTRIES };
}
