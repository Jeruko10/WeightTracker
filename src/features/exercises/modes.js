import { byId, playEnter } from '../../lib/dom.js';
import { state, MODES, closeAllForms, saveMode, setFocusDay } from './state.js';
import { render } from './views/render.js';

export function updateModeBtn() {
  document.querySelectorAll('#mode-seg [data-mode]').forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  byId('edit-band').hidden = state.mode !== 'edit';
}

// Re-plays the fade-in on the content that was just swapped (mode, day pick, change day).
export function playTreeEnter() {
  playEnter(byId('ex-tree'));
  playEnter(byId('ex-detail'));
  playEnter(byId('focus-title'));
}

// Leaving Train drops the trained day, so the next visit starts from the day picker.
function leaveTrain() {
  setFocusDay(null);
  state.focusExpanded.clear();
}

export function setMode(mode) {
  if (!MODES.includes(mode) || mode === state.mode) return;
  if (state.mode === 'train') leaveTrain();
  state.mode = mode;
  saveMode();
  closeAllForms();
  // Logging always targets the active machine track, so Train starts from it.
  if (mode === 'train') state.track = {};
  byId('new-day-err').textContent = '';
  render();
  playTreeEnter();
  if (mode === 'train') window.scrollTo(0, 0);
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
