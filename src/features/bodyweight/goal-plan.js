import { addDays, today } from '../../lib/dates.js';

export function planGoal(target, start, pace, entries) {
  const n = entries.length;
  const current = n ? entries[n - 1].weight : null;
  const startWeight = current !== null ? current : target;
  const delta = target - startWeight;
  const weeks = Math.abs(delta / pace) || 1;
  const days = Math.round(weeks * 7);
  return { current, startWeight, delta, isBulk: delta >= 0, weeks, days, endDate: addDays(start, days) };
}

// Goals saved before startWeight existed fall back to the first entry on or after the start.
export function goalStartWeight(goal, entries) {
  if (goal.startWeight !== undefined && goal.startWeight !== null) return goal.startWeight;
  const e = entries.find((x) => x.date >= goal.start);
  return e ? e.weight : null;
}

// Legacy goals may lack isBulk/startWeight: left out, since Firestore rejects undefined and the whole write would fail.
export function archiveGoal(goal) {
  const archived = {
    weight: goal.weight, start: goal.start, date: goal.date,
    pace: goal.pace || null, isBulk: goal.isBulk, startWeight: goal.startWeight,
    savedOn: today(),
  };
  Object.keys(archived).forEach((k) => { if (archived[k] === undefined) delete archived[k]; });
  return archived;
}

export function hasTimeline(goal) {
  return !!(goal && goal.start && goal.date);
}
