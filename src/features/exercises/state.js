// In-memory state of the Exercises section: the user's data plus UI state. Mutated in place so
// every module sees the same values.
import { loadPref, savePref, loadJSON, saveJSON } from '../../lib/storage.js';
import { STORAGE_KEYS } from './constants.js';

// View (read-only, the default), Edit (structure and history) or Train (one day, nothing else).
export const MODES = ['view', 'edit', 'train'];
export const MODE_LABEL = { view: 'View', edit: 'Edit', train: 'Train' };

function initialMode() {
  const m = loadPref(STORAGE_KEYS.mode, 'view');
  return MODES.includes(m) ? m : 'view';
}

export const state = {
  /** Signed-in user, or null — the tree renders nothing without one */
  uid: null,
  loaded: false,
  loadError: false,

  // Firestore data — see repository.js for the layout.
  days: [],
  exercises: [],
  logs: [],
  deloads: [],

  // The mode and trained day survive a reload, so a refresh mid-workout lands back in Train;
  // any way of leaving Train (another mode, or the Bodyweight section) drops the day, so the
  // next visit starts from the day picker.
  mode: initialMode(),
  focusDay: loadPref(STORAGE_KEYS.focusDay, null),

  /** Fold keys currently open: 'deload', 'd:<dayId>', 'e:<exId>', 'c:<exId>' (chart) */
  open: new Set(loadJSON(STORAGE_KEYS.open, [])),
  /** Set keys ('<exId>:<setId>') whose full history is expanded */
  showAll: new Set(),
  /** Which inline form is open, if any. Only one at a time keeps the tree calm. */
  ui: { addFor: null, editLog: null, editDay: null, editEx: null, newExFor: null, editDeload: null },

  // Train mode: finished exercises the user re-opened, and the one that just finished (rendered
  // open once so its fold-away can be seen).
  focusExpanded: new Set(),
  justCompleted: null,
};

export function isEdit() {
  return state.mode === 'edit';
}

/** View is read-only: logging (sets and deload starts) happens in Edit and Train. */
export function canLog() {
  return state.mode !== 'view';
}

/** Closes every edit form. The "log a set" form (ui.addFor) is handled separately. */
export function resetForms() {
  const ui = state.ui;
  ui.editLog = null; ui.editDay = null; ui.editEx = null; ui.newExFor = null; ui.editDeload = null;
}

export function closeAllForms() {
  resetForms();
  state.ui.addFor = null;
}

export function saveMode() {
  savePref(STORAGE_KEYS.mode, state.mode);
}

export function setFocusDay(id) {
  state.focusDay = id;
  savePref(STORAGE_KEYS.focusDay, id);
}

export function saveOpen() {
  saveJSON(STORAGE_KEYS.open, Array.from(state.open));
}
