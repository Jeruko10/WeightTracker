// Redraws the Exercises section from state. Called after every change.
import { byId } from '../../../lib/dom.js';
import { state, isEdit } from '../state.js';
import { sortedDays } from '../selectors.js';
import { destroyCharts } from '../charts.js';
import { updateExpandBtn, mountOpenCharts } from '../folds.js';
import { updateModeBtn } from '../modes.js';
import { dayHtml } from './tree.js';
import { deloadHtml } from './deload.js';
import { renderTrain } from './train.js';

function treeHtml() {
  const days = sortedDays();
  const body = days.length
    ? days.map(dayHtml).join('')
    : '<p class="empty">' + (isEdit()
      ? 'Create your first training day above.'
      : 'No training days yet. Switch to <b>Edit mode</b> to create one.') + '</p>';
  return deloadHtml() + body;
}

export function render() {
  const tree = byId('ex-tree');
  if (!tree) return;
  destroyCharts();
  byId('exercises-view').classList.toggle('editing', isEdit());
  // data-focus lets the stylesheet strip the shared chrome (section switch, user bar) too.
  document.querySelector('.app').toggleAttribute('data-focus', state.mode === 'train');
  byId('focus-title').innerHTML = '';
  updateModeBtn();

  if (!state.uid) {
    tree.innerHTML = '';
  } else if (!state.loaded) {
    tree.innerHTML = state.loadError
      ? '<p class="empty">Couldn\'t load your exercises. Check your connection and reload.</p>'
      : '<p class="empty">Loading…</p>';
  } else if (state.mode === 'train') {
    renderTrain(tree);
    return; // Train has no folds, so the expand button is left as it was
  } else {
    tree.innerHTML = treeHtml();
    mountOpenCharts();
  }
  updateExpandBtn();
}
