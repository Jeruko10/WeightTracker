// User preferences that aren't the theme. Stored in localStorage (per device), never in Firestore.
import { loadPref, savePref } from '../lib/storage.js';

/** Weight increments the number fields step by (kg). */
export const WEIGHT_STEPS = [1, 2.5, 5];
const DEFAULT_STEP = 2.5;
const KEY = 'wt-weight-step';

export function getWeightStep() {
  const n = Number(loadPref(KEY, DEFAULT_STEP));
  return WEIGHT_STEPS.includes(n) ? n : DEFAULT_STEP;
}

export function setWeightStep(n) {
  savePref(KEY, WEIGHT_STEPS.includes(n) ? String(n) : null);
}
