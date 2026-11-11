// Mutated in place: an imported `let` can't be reassigned from outside its module.
export const state = {
  // entries: oldest first; goalHistory: newest first.
  entries: [],
  goal: null,
  goalHistory: [],
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
