// Public API of the Exercises section. Nothing outside this folder imports anything else.
import { byId } from '../../lib/dom.js';
import { showSync } from '../../shared/sync-status.js';
import { state, closeAllForms, saveMode, setFocusDay } from './state.js';
import { fetchAll } from './repository.js';
import { pruneOpen, expandAll } from './folds.js';
import { setMode } from './modes.js';
import { applyRoute } from './nav.js';
import { handleAction, addDay } from './actions.js';
import { render } from './views/render.js';

export { resetExercisesMode } from './modes.js';
export { exportSections } from './export.js';
export { applyRoute as applyExercisesRoute } from './nav.js';
export { setBodyweightProvider } from './bodyweight-source.js';

export function initExercises() {
  const view = byId('exercises-view'), tree = byId('ex-tree'), focusTitle = byId('focus-title'), detail = byId('ex-detail');
  // One delegated listener for the list, the detail pane and the Train title ("Change day").
  view.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t && (tree.contains(t) || detail.contains(t) || focusTitle.contains(t))) handleAction(t);
  });
  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    // Enter in any inline form submits it.
    if (e.key === 'Enter' && t.tagName === 'INPUT') {
      if (t.id === 'new-day-name') {
        e.preventDefault();
        addDay();
        return;
      }
      const form = t.closest('[data-form]'), submit = form && form.querySelector('.btn.primary');
      if (submit) {
        e.preventDefault();
        submit.click();
      }
      return;
    }
    // Fold headers are divs (they contain buttons), so give them keyboard activation by hand.
    if (t.dataset && t.dataset.action === 'toggle' && t.tagName !== 'BUTTON') {
      e.preventDefault();
      handleAction(t);
    }
  });
  byId('btn-add-day').addEventListener('click', addDay);
  byId('btn-expand-all').addEventListener('click', expandAll);
  byId('mode-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  // Unilateral log forms: "same weight" keeps the right side's weight following the left's.
  view.addEventListener('input', (e) => {
    const t = e.target, form = t.closest && t.closest('[data-uni]');
    if (!form || t.name !== 'weight-l' || !form.querySelector('[name=same]').checked) return;
    form.querySelector('[name=weight-r]').value = t.value;
  });
  view.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name !== 'same') return;
    const r = t.closest('[data-uni]').querySelector('[name=weight-r]');
    r.disabled = t.checked;
    if (t.checked) r.value = t.closest('[data-uni]').querySelector('[name=weight-l]').value;
  });
  render();
}

export async function loadExercises(uid) {
  state.uid = uid;
  state.loaded = false;
  state.loadError = false;
  render();
  try {
    Object.assign(state, await fetchAll());
    state.loaded = true;
    pruneOpen();
  } catch (e) {
    console.error(e);
    state.loadError = true;
    showSync('Error loading exercises', 'error');
  }
  render();
}

export function clearExercises() {
  Object.assign(state, {
    uid: null, days: [], exercises: [], logs: [], deloads: [], loaded: false, track: {}, view: { kind: 'list', id: null },
  });
  state.mode = 'view';
  saveMode();
  setFocusDay(null);
  closeAllForms();
  render();
}

/** Re-renders after data from another section arrives (e.g. bodyweight, which tonnage uses). */
export function refreshExercises() {
  render();
}
