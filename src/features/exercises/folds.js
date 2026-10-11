// Fold state of the tree (which days, exercises and charts are open), remembered across reloads,
// plus the "Expand all / Collapse all" toolbar button.
import { byId } from '../../lib/dom.js';
import { chevron } from './constants.js';
import { state, saveOpen } from './state.js';
import { mountChart, destroyChart } from './charts.js';

const CHART_PREFIX = 'c:';
const CHART_CLOSE_MS = 300;

/** Every fold "Expand all" opens. Charts are deliberately not included. */
function foldKeys() {
  return ['deload']
    .concat(state.days.map((d) => 'd:' + d.id))
    .concat(state.exercises.map((x) => 'e:' + x.id));
}

/** Forgets remembered folds for things deleted on another device. */
export function pruneOpen() {
  const live = new Set(foldKeys().concat(state.exercises.map((x) => CHART_PREFIX + x.id)));
  state.open = new Set(Array.from(state.open).filter((k) => live.has(k)));
  saveOpen();
}

export function openFold(key) {
  state.open.add(key);
  saveOpen();
}

function allExpanded() {
  const keys = foldKeys();
  return keys.length > 0 && keys.every((k) => state.open.has(k));
}

export function updateExpandBtn() {
  const btn = byId('btn-expand-all'), all = allExpanded();
  btn.disabled = !state.loaded;
  btn.innerHTML = chevron(all ? ' up' : '') + (all ? 'Collapse all' : 'Expand all');
}

/** Mounts the chart of every open chart fold (after the tree was re-rendered). */
export function mountOpenCharts() {
  state.open.forEach((k) => { if (k.startsWith(CHART_PREFIX)) mountChart(k.slice(CHART_PREFIX.length)); });
}

// Toggles classes on the existing nodes instead of re-rendering, so the CSS transition plays.
function setOpen(box, isOpen) {
  const key = box.dataset.key;
  if (box.classList.contains('open') === isOpen) return;
  box.classList.toggle('open', isOpen);
  if (isOpen) state.open.add(key);
  else state.open.delete(key);
  if (key.startsWith(CHART_PREFIX)) {
    const exId = key.slice(CHART_PREFIX.length);
    if (isOpen) mountChart(exId);
    // Destroyed only once the fold has finished closing, so the chart doesn't vanish mid-slide.
    else setTimeout(() => { if (!state.open.has(key)) destroyChart(exId); }, CHART_CLOSE_MS);
  }
}

export function toggleFold(box) {
  setOpen(box, !box.classList.contains('open'));
  saveOpen();
  updateExpandBtn();
}

export function expandAll() {
  const expand = !allExpanded();
  if (expand) foldKeys().forEach((k) => state.open.add(k));
  document.querySelectorAll('#ex-tree .foldable').forEach((box) => {
    // Charts are the optional last level: Expand all leaves them as they are, Collapse all
    // closes them.
    if (box.dataset.key.startsWith(CHART_PREFIX)) {
      if (!expand) setOpen(box, false);
      return;
    }
    setOpen(box, expand);
  });
  if (!expand) state.open.clear();
  saveOpen();
  updateExpandBtn();
}
