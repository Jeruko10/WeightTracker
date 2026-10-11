// The Deload card at the top of the tree: current phase, and the list of deload starts.
import { today, formatDate, formatDateShort, daysBetween } from '../../../lib/dates.js';
import { ICON, chevron } from '../constants.js';
import { state, isEdit } from '../state.js';
import { deloadsNewestFirst, currentDeload, nextDeload, previousDeload, cyclePhase, weeksText } from '../deloads.js';
import { iconBtn, textBtn, saveCancel, foldClass } from './components.js';

function dateForm(formId, date, buttons) {
  return `<div class="deload-form" data-form="${formId}">` +
    `<input type="date" name="date" value="${date}" aria-label="Deload start date">` +
    buttons + '<p class="err"></p></div>';
}

function deloadRow(d) {
  if (state.ui.editDeload === d.id) return dateForm('deload:' + d.id, d.date, saveCancel('Save', 'deloadedit-save', d.id));
  const prev = previousDeload(d);
  const note = d.date > today() ? 'Planned'
    : prev ? weeksText(daysBetween(prev.date, d.date)) + ' after previous'
    : 'First recorded';
  return '<div class="deload-row">' +
    `<span class="deload-date">${formatDate(d.date)}</span>` +
    `<span class="meta">${note}</span>` +
    '<span class="row-actions edit-only">' +
      iconBtn(ICON.edit, 'deload-edit', d.id, 'Edit deload') +
      iconBtn(ICON.del, 'deload-del', d.id, 'Delete deload', false, true) +
    '</span></div>';
}

export function deloadHtml() {
  const key = 'deload', cur = currentDeload(), next = nextDeload();
  const phase = cur ? cyclePhase(cur) : null;
  const summary = cur ? phase.text + ' · started ' + formatDateShort(cur.date)
    : next ? 'Next deload starts ' + formatDateShort(next.date)
    : 'No deload recorded yet';
  const rows = deloadsNewestFirst().map(deloadRow).join('');
  const addForm = isEdit() ? dateForm('deload-new', today(), textBtn('Mark deload start', 'deload-add', '', 'btn primary sm')) : '';
  const list = rows
    ? `<div class="deload-list">${rows}</div>`
    : isEdit() ? '' : '<p class="hist-empty">Switch to Edit mode to mark a deload start.</p>';
  return `<div class="card deload-card ${foldClass(key)}" data-key="${key}">` +
    '<div class="fold-head deload-head" data-action="toggle" role="button" tabindex="0">' + chevron() +
      `<div class="ex-titles"><span class="day-name">Deload</span><span class="meta">${summary}</span></div>` +
      (phase && phase.deloadWeek ? '<span class="chip deload-chip">Deload week</span>' : '') + '</div>' +
    `<div class="fold"><div class="fold-inner"><div class="deload-body">${addForm}${list}</div></div></div></div>`;
}
