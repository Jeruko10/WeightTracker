// The View/Edit tree: training day → exercise → set → history, each level foldable.
import { today, formatDateShort } from '../../../lib/dates.js';
import { esc, plural } from '../../../lib/html.js';
import { ICON, HISTORY_PREVIEW, CHART_ENTRIES, SET_COLORS, chevron } from '../constants.js';
import { state, isEdit, canLog } from '../state.js';
import { dayExercises, setLogs, rangeText, repsState, uniformRange, lastWeight, formatWeight } from '../selectors.js';
import { iconBtn, textBtn, saveCancel, editActions, foldClass, setDot } from './components.js';
import { logForm, exerciseForm } from './forms.js';

function foldBox(cls, key, head, body) {
  return `<div class="${cls} ${foldClass(key)}" data-key="${key}">${head}` +
    `<div class="fold"><div class="fold-inner">${body}</div></div></div>`;
}

// ── Day ───────────────────────────────────────────────────────────────────────
export function dayHtml(d, i, all) {
  const exs = dayExercises(d.id), key = 'd:' + d.id;
  const head = state.ui.editDay === d.id
    ? `<div class="rename-row" data-form="day:${d.id}">` +
        `<input type="text" name="name" maxlength="40" value="${esc(d.name)}" aria-label="Day name">` +
        saveCancel('Save', 'day-rename-save', d.id) + '</div>'
    : '<div class="fold-head day-head" data-action="toggle" role="button" tabindex="0">' + chevron() +
        `<span class="day-name">${esc(d.name)}</span>` +
        `<span class="meta">${exs.length} ${plural(exs.length, 'exercise')}</span>` +
        editActions('day', d.id, i, all.length) + '</div>';
  let body = exs.length
    ? exs.map((x, j) => exerciseHtml(x, j, exs.length)).join('')
    : `<p class="hist-empty">No exercises yet${isEdit() ? '' : '. Switch to Edit mode to add some'}</p>`;
  body += state.ui.newExFor === d.id
    ? `<div class="edit-only">${exerciseForm(null, d.id)}</div>`
    : textBtn('+ Add exercise', 'ex-new', d.id, 'add-ex-btn edit-only');
  return foldBox('day card', key, head, `<div class="day-body">${body}</div>`);
}

// ── Exercise ──────────────────────────────────────────────────────────────────
function exerciseSummary(x) {
  const n = x.sets.length;
  return n + ' ' + plural(n, 'set') + (uniformRange(x) ? ' · ' + rangeText(x.sets[0]) + ' reps' : '');
}

function exerciseHtml(x, j, count) {
  const head = '<div class="fold-head ex-head" data-action="toggle" role="button" tabindex="0">' + chevron() +
    `<div class="ex-titles"><span class="ex-name">${esc(x.name)}</span><span class="meta">${exerciseSummary(x)}</span></div>` +
    editActions('ex', x.id, j, count) + '</div>';
  const body = state.ui.editEx === x.id
    ? exerciseForm(x, x.dayId)
    : x.sets.map((s, k) => setHtml(x, s, k)).join('') + chartHtml(x);
  return foldBox('ex', 'e:' + x.id, head, `<div class="ex-body">${body}</div>`);
}

// ── Set and its history ───────────────────────────────────────────────────────
function setHtml(x, s, k) {
  const sk = x.id + ':' + s.id, hist = setLogs(x.id, s.id).reverse();
  const adding = state.ui.addFor === sk, expanded = state.showAll.has(sk);
  const shown = expanded ? hist : hist.slice(0, HISTORY_PREVIEW);
  let h = '<div class="set"><div class="set-head">' + setDot(k) +
    `<span class="set-name">Set ${k + 1}</span>` +
    `<span class="set-range">${rangeText(s)} reps</span>` +
    (adding || !canLog() ? '' : textBtn('+ Log', 'log-open', sk, 'log-btn')) + '</div>';
  if (adding) h += logForm({ date: today(), reps: '', weight: lastWeight(x, k) }, 'log-save', sk);
  if (!hist.length && !adding) h += '<p class="hist-empty">No entries yet</p>';
  else if (hist.length) h += `<div class="hist">${shown.map((l) => logRow(l, s)).join('')}</div>`;
  if (hist.length > HISTORY_PREVIEW) {
    h += textBtn(expanded ? 'Show less' : 'Show all (' + hist.length + ')', 'hist-more', sk, 'link-btn');
  }
  return h + '</div>';
}

const REPS_TITLE = { up: 'Above target range', down: 'Below target range', in: 'Within target range' };

/** The reps badge: green ↑ above the target range, red ↓ below it, neutral inside. */
export function repsCell(reps, s, title) {
  const st = repsState(reps, s);
  const arrow = st === 'up' ? ICON.up : st === 'down' ? ICON.down : '';
  return `<span class="reps-cell ${st}"${title ? ` title="${REPS_TITLE[st]}"` : ''}>${arrow}${reps} <small>reps</small></span>`;
}

function logRow(l, s) {
  if (state.ui.editLog === l.id) return logForm(l, 'logedit-save', l.id);
  return '<div class="hist-row">' +
    `<span class="hist-date">${formatDateShort(l.date)}</span>` +
    repsCell(l.reps, s, true) +
    `<span class="hist-wt">${formatWeight(l.weight)} <small>kg</small></span>` +
    '<span class="row-actions edit-only">' +
      iconBtn(ICON.edit, 'log-edit', l.id, 'Edit entry') +
      iconBtn(ICON.del, 'log-del', l.id, 'Delete entry', false, true) +
    '</span></div>';
}

// ── Chart fold (the chart itself is mounted by charts.js once the fold is open) ─
function chartHtml(x) {
  const key = 'c:' + x.id;
  const hasLogs = x.sets.some((s) => setLogs(x.id, s.id).length);
  const inner = hasLogs
    ? '<div class="chart-legend">' +
        x.sets.map((s, k) => `<span class="leg-item"><span class="leg-dot" style="background:${SET_COLORS[k]}"></span>Set ${k + 1}</span>`).join('') +
      `</div><div class="ex-chart-wrap"><canvas data-chart="${x.id}"></canvas></div>`
    : '<p class="hist-empty">Log some entries to see the chart</p>';
  const head = '<button class="fold-head chart-head" data-action="toggle">' + chevron() +
    `<span>Progress chart</span><span class="meta">last ${CHART_ENTRIES} entries · reps</span></button>`;
  return foldBox('chart-fold', key, head, inner);
}
