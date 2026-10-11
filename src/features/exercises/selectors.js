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
  return state.exercises.filter((x) => x.dayId === dayId).sort(byOrder);
}

/** One set's history, oldest first. */
export function setLogs(exId, setId) {
  return state.logs.filter((l) => l.exerciseId === exId && l.setId === setId).sort(byDate);
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
// usually starts at set 2's weight), else whatever any set of the exercise last used.
export function lastWeight(x, k) {
  for (let i = k; i >= 0; i--) {
    const h = setLogs(x.id, x.sets[i].id);
    if (h.length) return h[h.length - 1].weight;
  }
  const all = state.logs.filter((l) => l.exerciseId === x.id).sort(byDate);
  return all.length ? all[all.length - 1].weight : '';
}

// An exercise is finished for today once every set's latest log is dated today.
export function setDoneToday(x, s) {
  const h = setLogs(x.id, s.id);
  return h.length > 0 && h[h.length - 1].date === today();
}

export function exDoneToday(x) {
  return x.sets.length > 0 && x.sets.every((s) => setDoneToday(x, s));
}
