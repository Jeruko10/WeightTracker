// Read-only queries over the Exercises state. No DOM, no Firebase.
import { today } from '../../lib/dates.js';
import { state } from './state.js';

export function byOrder(a, b) {
  return (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0);
}

export function byDate(a, b) {
  return a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0);
}

export function findById(list, id) {
  return list.find((o) => o.id === id);
}

export function sortedDays() {
  return state.days.slice().sort(byOrder);
}

export function dayExercises(dayId) {
  return state.exercises.filter((x) => !x.archived && x.dayId === dayId).sort(byOrder);
}

/** Archived exercises keep their logs but belong to no day. */
export function archivedExercises() {
  return state.exercises.filter((x) => x.archived).sort((a, b) => a.name.localeCompare(b.name));
}

/** The machine label new logs are stamped with ('' = none). */
export function activeMachine(x) {
  return x.machine || '';
}

/** The machine track being viewed for an exercise (defaults to the active one). */
export function trackOf(x) {
  const t = state.track[x.id];
  return t === undefined ? activeMachine(x) : t;
}

/** Distinct machine labels used by the exercise's logs plus its active one, active first. */
export function machinesOf(x) {
  const set = new Set([activeMachine(x)]);
  state.logs.forEach((l) => { if (l.exerciseId === x.id) set.add(l.machine || ''); });
  return Array.from(set);
}

/** Every machine label used by any exercise, for the form's suggestions. */
export function knownMachines() {
  const set = new Set();
  state.exercises.forEach((x) => { if (x.machine) set.add(x.machine); });
  state.logs.forEach((l) => { if (l.machine) set.add(l.machine); });
  return Array.from(set).sort();
}

/** The sides a log recorded: one for a bilateral log, [left, right] for a unilateral one. */
export function logSides(l) {
  return l.left ? [l.left, l.right] : [{ reps: l.reps, weight: l.weight }];
}

/** One set's history on one machine track, oldest first. Defaults to the viewed track. */
export function setLogs(exId, setId, track) {
  const x = findById(state.exercises, exId);
  const t = track !== undefined ? track : x ? trackOf(x) : '';
  return state.logs
    .filter((l) => l.exerciseId === exId && l.setId === setId && (l.machine || '') === t)
    .sort(byDate);
}

export function rangeText(s) {
  return s.min === s.max ? String(s.min) : s.min + '–' + s.max;
}

/** Where a rep count sits against the set's target range: 'up' | 'down' | 'in'. */
export function repsState(reps, s) {
  return reps > s.max ? 'up' : reps < s.min ? 'down' : 'in';
}

export function uniformRange(x) {
  return x.sets.every((s) => s.min === x.sets[0].min && s.max === x.sets[0].max);
}

/** Weight with at most two decimals, no trailing zeros. */
export function formatWeight(w) {
  return String(Math.round((w || 0) * 100) / 100);
}

// Default weight for a new log: this set's last one, else the previous sets' (a fresh set 3
// usually starts at set 2's weight), else whatever any set of the exercise last used — always
// within the viewed machine track. `side` picks left (0) or right (1) for unilateral logs.
export function lastWeight(x, k, side = 0) {
  const pick = (l) => {
    const sides = logSides(l);
    return sides[Math.min(side, sides.length - 1)].weight;
  };
  for (let i = k; i >= 0; i--) {
    const h = setLogs(x.id, x.sets[i].id);
    if (h.length) return pick(h[h.length - 1]);
  }
  const t = trackOf(x);
  const all = state.logs.filter((l) => l.exerciseId === x.id && (l.machine || '') === t).sort(byDate);
  return all.length ? pick(all[all.length - 1]) : '';
}

// An exercise is finished for today once every set's latest log is dated today.
// "Done" always refers to the active machine track, whichever track is being viewed.
export function setDoneToday(x, s) {
  const l = lastLog(x, s);
  return !!l && l.date === today();
}

/** The latest log of a set on the exercise's active track, or null. */
export function lastLog(x, s) {
  const h = setLogs(x.id, s.id, activeMachine(x));
  return h.length ? h[h.length - 1] : null;
}

/** { done, total } exercises finished today in a day. */
export function dayProgress(d) {
  const exs = dayExercises(d.id);
  return { done: exs.filter(exDoneToday).length, total: exs.length };
}

export function sideText(side) {
  return side.reps + ' × ' + formatWeight(side.weight);
}

/** '10 × 62.5' for a bilateral log, 'L 10 × 24 · R 9 × 24' for a unilateral one. */
export function logSummary(l) {
  return l.left ? 'L ' + sideText(l.left) + ' · R ' + sideText(l.right) : sideText(l);
}

export function exDoneToday(x) {
  return x.sets.length > 0 && x.sets.every((s) => setDoneToday(x, s));
}
