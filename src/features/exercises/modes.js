// View / Edit / Train. The toolbar button cycles through them in that order.
import { byId, playEnter } from '../../lib/dom.js';
import { ICON } from './constants.js';
import { state, MODES, MODE_LABEL, closeAllForms, saveMode, setFocusDay } from './state.js';
import { render } from './views/render.js';

function nextMode() {
  return MODES[(MODES.indexOf(state.mode) + 1) % MODES.length];
}

export function updateModeBtn() {
  const btn = byId('mode-btn'), next = nextMode();
  btn.dataset.mode = state.mode;
  btn.innerHTML = '<span class="mode-dot"></span>' + MODE_LABEL[state.mode] + ICON.cycle;
  btn.title = 'Mode: ' + MODE_LABEL[state.mode] + '. Click for ' + MODE_LABEL[next] + '.';
  btn.setAttribute('aria-label', btn.title);
}

// Re-plays the fade-in on the content that was just swapped (mode, day pick, change day).
export function playTreeEnter() {
  playEnter(byId('ex-tree'));
  playEnter(byId('focus-title'));
}

/** Leaving Train drops the trained day, so the next visit starts from the day picker. */
function leaveTrain() {
  setFocusDay(null);
  state.focusExpanded.clear();
}

function setMode(mode) {
  if (state.mode === 'train' && mode !== 'train') leaveTrain();
  state.mode = mode;
  saveMode();
  closeAllForms();
  byId('new-day-err').textContent = '';
  render();
  playTreeEnter();
  if (mode === 'train') window.scrollTo(0, 0);
}

export function cycleMode() {
  setMode(nextMode());
}

// Called by the router whenever the Bodyweight section opens: coming back to Exercises from
// there always starts in read-only View, and Train starts again from the day picker.
export function resetExercisesMode() {
  if (state.mode === 'view' && !state.focusDay) return;
  if (state.mode === 'train') leaveTrain();
  state.mode = 'view';
  saveMode();
  closeAllForms();
  render();
}
