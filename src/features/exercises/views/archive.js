import { esc, plural } from '../../../lib/html.js';
import { state } from '../state.js';
import { archivedExercises, sortedDays } from '../selectors.js';
import { textBtn, backBar } from './components.js';

function row(x) {
  const n = state.logs.filter((l) => l.exerciseId === x.id).length;
  const days = sortedDays();
  const options = days.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  const restore = days.length
    ? `<select name="day" aria-label="Restore ${esc(x.name)} to day">${options}</select>` +
      textBtn('Restore', 'ex-restore', x.id, 'btn primary sm')
    : '<span class="meta">Create a training day to restore it.</span>';
  return '<div class="arch-row">' +
    `<button class="arch-main" data-action="ex-open" data-id="${x.id}">` +
      `<span class="ex-name">${esc(x.name)}${x.machine ? ` <span class="tag machine">${esc(x.machine)}</span>` : ''}</span>` +
      `<span class="meta">${n} ${plural(n, 'entry', 'entries')} · view history</span></button>` +
    `<div class="arch-actions edit-only">${restore}` +
      `<button class="icon-btn danger arch-del" data-action="ex-del" data-id="${x.id}" title="Delete for good" aria-label="Delete ${esc(x.name)} for good">✕</button>` +
    '</div></div>';
}

export function archiveHtml() {
  const list = archivedExercises();
  return backBar('Archive') +
    '<p class="help">Archived exercises keep all their logs but don’t appear in training days, Train or Export.</p>' +
    (list.length ? `<div class="arch-list">${list.map(row).join('')}</div>`
      : '<p class="empty">No archived exercises.</p>');
}
