import { byId } from '../../lib/dom.js';
import { chevron } from './constants.js';
import { state, saveOpen } from './state.js';

function foldKeys() {
  return ['deload']
    .concat(state.days.map((d) => 'd:' + d.id))
    .concat(state.exercises.filter((x) => !x.archived).map((x) => 'e:' + x.id));
}

// Forgets folds of things deleted on another device.
export function pruneOpen() {
  const live = new Set(foldKeys());
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

// Toggles classes on the existing nodes instead of re-rendering, so the CSS transition plays.
function setOpen(box, isOpen) {
  if (box.classList.contains('open') === isOpen) return;
  box.classList.toggle('open', isOpen);
  const key = box.dataset.key;
  if (isOpen) state.open.add(key);
  else state.open.delete(key);
  const toggle = box.querySelector(':scope > .ex-row-head > .ex-exp');
  if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
}

export function toggleFold(box) {
  setOpen(box, !box.classList.contains('open'));
  saveOpen();
  updateExpandBtn();
}

export function expandAll() {
  const expand = !allExpanded();
  if (expand) foldKeys().forEach((k) => state.open.add(k));
  document.querySelectorAll('#ex-tree .foldable').forEach((box) => setOpen(box, expand));
  if (!expand) state.open.clear();
  saveOpen();
  updateExpandBtn();
}
