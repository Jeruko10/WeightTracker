// The list screen: training days (accordions) holding compact exercise rows. A row opens the
// exercise's detail screen (detail.js); its small chevron expands the sets inline.
import { esc, plural } from '../../../lib/html.js';
import { ICON, chevron } from '../constants.js';
import { state, isEdit } from '../state.js';
import {
  dayExercises, archivedExercises, dayProgress, exDoneToday, setDoneToday, lastLog, logSummary, rangeText,
  uniformRange, activeMachine,
} from '../selectors.js';
import { iconBtn, textBtn, saveCancel, editActions, foldClass, setDot } from './components.js';

function foldBox(cls, key, head, body) {
  return `<div class="${cls} ${foldClass(key)}" data-key="${key}">${head}` +
    `<div class="fold"><div class="fold-inner">${body}</div></div></div>`;
}

// ── Day ───────────────────────────────────────────────────────────────────────
export function dayHtml(d, i, all) {
  const exs = dayExercises(d.id), key = 'd:' + d.id, p = dayProgress(d);
  const head = state.ui.editDay === d.id
    ? `<div class="rename-row" data-form="day:${d.id}">` +
        `<input type="text" name="name" maxlength="40" value="${esc(d.name)}" aria-label="Day name">` +
        saveCancel('Save', 'day-rename-save', d.id) + '</div>'
    : '<div class="fold-head day-head" data-action="toggle" role="button" tabindex="0">' + chevron() +
        `<span class="day-name">${esc(d.name)}</span>` +
        `<span class="meta">${p.total ? p.done + '/' + p.total + ' done' : '0 exercises'}</span>` +
        iconBtn(ICON.download, 'day-export', d.id, 'Export this day as HTML', !p.total) +
        editActions('day', d.id, i, all.length) + '</div>';
  let body = exs.length
    ? exs.map((x, j) => exerciseRow(x, j, exs.length)).join('')
    : `<p class="hist-empty">No exercises yet${isEdit() ? '' : '. Switch to Edit mode to add some'}</p>`;
  body += textBtn('+ Add exercise', 'ex-new', d.id, 'add-ex-btn edit-only');
  return foldBox('day card', key, head, `<div class="day-body">${body}</div>`);
}

// ── Exercise row ──────────────────────────────────────────────────────────────
function statusIcon(x) {
  const done = x.sets.filter((s) => setDoneToday(x, s)).length;
  if (exDoneToday(x)) return `<span class="status done" title="Done today">${ICON.check}</span>`;
  if (done) return `<span class="status part" title="${done} of ${x.sets.length} sets today">${done}/${x.sets.length}</span>`;
  return '<span class="status todo" title="Not done today"></span>';
}

function exerciseSummary(x) {
  const n = x.sets.length, first = lastLog(x, x.sets[0]);
  return n + ' ' + plural(n, 'set') + (uniformRange(x) ? ' · ' + rangeText(x.sets[0]) + ' reps' : '') +
    (first ? ' · last ' + logSummary(first) : '');
}

function setLine(x, s, k) {
  const l = lastLog(x, s);
  return '<div class="set-line">' + setDot(k) + `<span class="set-name">Set ${k + 1}</span>` +
    `<span class="set-range">${rangeText(s)} reps</span>` +
    `<span class="set-last">${l ? logSummary(l) + ' kg' : 'No entries yet'}</span></div>`;
}

function exerciseRow(x, j, count) {
  const key = 'e:' + x.id, machine = activeMachine(x);
  const open = state.open.has(key);
  return `<div class="ex-row foldable${open ? ' open' : ''}" data-key="${key}">` +
    '<div class="ex-row-head">' +
      `<button class="ex-open" data-action="ex-open" data-id="${x.id}">${statusIcon(x)}` +
        `<span class="ex-titles"><span class="ex-name">${esc(x.name)}${x.unilateral ? ' <span class="tag">L/R</span>' : ''}</span>` +
        (machine ? `<span class="tag machine">${esc(machine)}</span>` : '') +
        `<span class="meta">${exerciseSummary(x)}</span></span></button>` +
      '<span class="row-actions edit-only">' +
        iconBtn(ICON.up, 'ex-up', x.id, 'Move up', j === 0) +
        iconBtn(ICON.down, 'ex-down', x.id, 'Move down', j === count - 1) +
        iconBtn(ICON.edit, 'ex-edit', x.id, 'Edit exercise') +
      '</span>' +
      `<button class="icon-btn ex-exp" data-action="toggle" aria-label="Show sets" aria-expanded="${open}">${chevron()}</button>` +
    '</div>' +
    `<div class="fold"><div class="fold-inner"><div class="ex-sets">${x.sets.map((s, k) => setLine(x, s, k)).join('')}</div></div></div>` +
  '</div>';
}

// ── Archive entry at the end of the list ──────────────────────────────────────
export function archiveLinkHtml() {
  const n = archivedExercises().length;
  return `<button class="archive-link" data-action="archive-open">${ICON.archive}` +
    `<span>Archive</span><span class="meta">${n} ${plural(n, 'exercise')}</span>${ICON.next}</button>`;
}
