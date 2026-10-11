// Goal maths shared by the form preview, Save, the banner and the chart. Pure: no DOM.
import { addDays, today } from '../../lib/dates.js';

/**
 * Turns the form inputs into a full plan. The goal starts from the latest logged weight (or
 * the target itself when nothing is logged yet) and the end date follows from distance ÷ pace.
 */
export function planGoal(target, start, pace, entries) {
  const n = entries.length;
  const current = n ? entries[n - 1].weight : null;
  const startWeight = current !== null ? current : target;
  const delta = target - startWeight;
  const weeks = Math.abs(delta / pace) || 1;
  const days = Math.round(weeks * 7);
  return { current, startWeight, delta, isBulk: delta >= 0, weeks, days, endDate: addDays(start, days) };
}

/**
 * The weight a goal started from. Prefers the value stored on the goal; goals saved before that
 * field existed fall back to the first entry logged on or after the start (null if none).
 */
export function goalStartWeight(goal, entries) {
  if (goal.startWeight !== undefined && goal.startWeight !== null) return goal.startWeight;
  const e = entries.find((x) => x.date >= goal.start);
  return e ? e.weight : null;
}

/** The record stored in goalHistory when a goal is replaced, completed or reset. */
export function archiveGoal(goal, { keepStartWeight = false } = {}) {
  const archived = {
    weight: goal.weight, start: goal.start, date: goal.date,
    pace: goal.pace || null, isBulk: goal.isBulk,
  };
  if (keepStartWeight) archived.startWeight = goal.startWeight;
  archived.savedOn = today();
  return archived;
}

/** True when the goal has both ends of its timeline (older or partial goals may not). */
export function hasTimeline(goal) {
  return !!(goal && goal.start && goal.date);
}
