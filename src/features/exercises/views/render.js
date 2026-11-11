import { byId } from '../../../lib/dom.js';
import { state, isEdit } from '../state.js';
import { sortedDays } from '../selectors.js';
import { destroyCharts, mountChart } from '../charts.js';
import { updateExpandBtn } from '../folds.js';
import { updateModeBtn } from '../modes.js';
import { dayHtml, archiveLinkHtml } from './tree.js';
import { deloadHtml } from './deload.js';
import { detailHtml } from './detail.js';
import { archiveHtml } from './archive.js';
import { renderTrain, stopRest } from './train.js';

function treeHtml() {
  const days = sortedDays();
  const body = days.length
    ? days.map(dayHtml).join('')
    : '<p class="empty">' + (isEdit()
      ? 'Create your first training day above.'
      : 'No training days yet. Switch to <b>Edit mode</b> to create one.') + '</p>';
  return deloadHtml() + body + archiveLinkHtml();
}

function paneHtml() {
  if (state.view.kind === 'archive' && !state.ui.newExFor) return state.loaded ? archiveHtml() : null;
  return detailHtml();
}

export function render() {
  const tree = byId('ex-tree'), pane = byId('ex-detail');
  if (!tree) return;
  destroyCharts();
  stopRest();
  byId('exercises-view').classList.toggle('editing', isEdit());
  // data-focus lets the stylesheet strip the shared chrome (section switch, user bar) too.
  document.querySelector('.app').toggleAttribute('data-focus', state.mode === 'train');
  byId('focus-title').innerHTML = '';
  updateModeBtn();
  const layout = byId('ex-layout');
  layout.classList.remove('has-detail');
  pane.innerHTML = '';

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
  }

  const html = state.uid && state.mode !== 'train' ? paneHtml() : null;
  if (html) {
    pane.innerHTML = html;
    layout.classList.add('has-detail');
    if (state.view.kind === 'ex') mountChart(state.view.id);
  } else if (state.uid && state.loaded) {
    pane.innerHTML = '<p class="detail-empty">Select an exercise to see its history and tonnage.</p>';
  }
  updateExpandBtn();
}
