// Small HTML building blocks shared by the Exercises views. Every interactive element carries
// data-action (+ data-id), handled by the single delegated listener in actions.js.
import { ICON, SET_COLORS } from '../constants.js';
import { state } from '../state.js';

export function iconBtn(icon, action, id, title, disabled = false, danger = false) {
  return `<button class="icon-btn${danger ? ' danger' : ''}" data-action="${action}" data-id="${id}" ` +
    `title="${title}" aria-label="${title}"${disabled ? ' disabled' : ''}>${icon}</button>`;
}

export function textBtn(label, action, id, cls) {
  return `<button class="${cls}" data-action="${action}" data-id="${id || ''}">${label}</button>`;
}

/** Save + Cancel pair used at the bottom of every inline form. */
export function saveCancel(label, action, id) {
  return textBtn(label, action, id, 'btn primary sm') + textBtn('Cancel', 'cancel', '', 'btn secondary sm');
}

/** Move up / Move down / Edit / Delete, shown only in Edit mode. */
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

/** The coloured dot that identifies set k across rows, forms and charts. */
export function setDot(k) {
  return `<span class="set-dot" style="background:${SET_COLORS[k]}"></span>`;
}
