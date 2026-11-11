// Every interactive element carries data-action (+ data-id), handled by the delegated listener in actions.js.
import { ICON, SET_COLORS } from '../constants.js';
import { state } from '../state.js';
import { repsState } from '../selectors.js';

export function iconBtn(icon, action, id, title, disabled = false, danger = false) {
  return `<button class="icon-btn${danger ? ' danger' : ''}" data-action="${action}" data-id="${id}" ` +
    `title="${title}" aria-label="${title}"${disabled ? ' disabled' : ''}>${icon}</button>`;
}

export function textBtn(label, action, id, cls) {
  return `<button class="${cls}" data-action="${action}" data-id="${id || ''}">${label}</button>`;
}

export function saveCancel(label, action, id) {
  return textBtn(label, action, id, 'btn primary sm') + textBtn('Cancel', 'cancel', '', 'btn secondary sm');
}

export function editActions(kind, id, index, count) {
  return '<span class="row-actions edit-only">' +
    iconBtn(ICON.up, kind + '-up', id, 'Move up', index === 0) +
    iconBtn(ICON.down, kind + '-down', id, 'Move down', index === count - 1) +
    iconBtn(ICON.edit, kind + '-edit', id, 'Edit') +
    iconBtn(ICON.del, kind + '-del', id, 'Delete', false, true) +
    '</span>';
}

export function foldClass(key) {
  return 'foldable' + (state.open.has(key) ? ' open' : '');
}

export function setDot(k) {
  return `<span class="set-dot" style="background:${SET_COLORS[k]}"></span>`;
}

const REPS_TITLE = { up: 'Above target range', down: 'Below target range', in: 'Within target range' };

export function repsCell(reps, s, title) {
  const st = repsState(reps, s);
  const arrow = st === 'up' ? ICON.up : st === 'down' ? ICON.down : '';
  return `<span class="reps-cell ${st}"${title ? ` title="${REPS_TITLE[st]}"` : ''}>${arrow}${reps} <small>reps</small></span>`;
}

export function backBar(title, actions = '') {
  return '<div class="dt-bar">' +
    iconBtn(ICON.back, 'detail-back', '', 'Back') +
    `<h2 class="dt-title">${title}</h2>${actions}</div>`;
}
