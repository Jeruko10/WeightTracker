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

/** Days in one training cycle (e.g. push, rest, pull, leg, rest = 5). Deload phases count in these. */
export const CYCLE_MIN = 2;
export const CYCLE_MAX = 14;
export const DEFAULT_CYCLE = 7;
const CYCLE_KEY = 'wt-cycle-length';

export function getCycleLength() {
  const n = Number(loadPref(CYCLE_KEY, DEFAULT_CYCLE));
  return Number.isInteger(n) && n >= CYCLE_MIN && n <= CYCLE_MAX ? n : DEFAULT_CYCLE;
}

/** Saves the cycle length and tells the app ('settingschange'), since phases are computed from it. */
export function setCycleLength(n) {
  const v = Math.min(CYCLE_MAX, Math.max(CYCLE_MIN, Math.round(n)));
  savePref(CYCLE_KEY, v === DEFAULT_CYCLE ? null : String(v));
  window.dispatchEvent(new Event('settingschange'));
}

export function setWeightStep(n) {
  savePref(KEY, WEIGHT_STEPS.includes(n) ? String(n) : null);
}
