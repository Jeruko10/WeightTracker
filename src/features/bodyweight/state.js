// In-memory state of the Bodyweight section. Mutated in place so every module sees the same
// values (an imported `let` can't be reassigned from outside its module).
export const state = {
  /** Logged weigh-ins, oldest first: { _id, date, weight } */
  entries: [],
  /** The active goal: { weight, start, date, pace, isBulk, startWeight } or null */
  goal: null,
  /** Archived goals, newest first; same shape plus `savedOn` */
  goalHistory: [],
  /** The recalculated goal offered when the active one is past due, until accepted */
  pendingReset: null,
};

export function resetState() {
  state.entries = [];
  state.goal = null;
  state.goalHistory = [];
  state.pendingReset = null;
}

export function sortEntries() {
  state.entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function latestWeight() {
  const n = state.entries.length;
  return n ? state.entries[n - 1].weight : null;
}
