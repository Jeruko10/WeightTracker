// Also hosts the exercise form (create/edit), so editing never happens squeezed inside the list.
import { today, formatDateShort } from '../../../lib/dates.js';
import { esc, plural } from '../../../lib/html.js';
import { ICON, HISTORY_PREVIEW, CHART_ENTRIES, MAX_MACHINE_LEN, chevron } from '../constants.js';
import { state, isEdit, canLog } from '../state.js';
import {
  findById, setLogs, rangeText, lastWeight, formatWeight, logSides, activeMachine, trackOf, machinesOf,
  exDoneToday, knownMachines,
} from '../selectors.js';
import { tonnageSeries } from '../tonnage.js';
import { bodyweightLookup } from '../bodyweight-source.js';
import { iconBtn, textBtn, setDot, repsCell, backBar } from './components.js';
import { logForm, exerciseForm } from './forms.js';

export function formatTonnage(kg) {
  return Math.round(kg).toLocaleString('en-US');
}

// ── Machine tracks ────────────────────────────────────────────────────────────
function trackSwitcher(x) {
  const tracks = machinesOf(x);
  if (tracks.length < 2) return '';
  const viewed = trackOf(x), active = activeMachine(x);
  const chips = tracks.map((t) => {
    const n = state.logs.filter((l) => l.exerciseId === x.id && (l.machine || '') === t).length;
    return `<button class="chip-btn${t === viewed ? ' on' : ''}" data-action="track-pick" data-id="${x.id}" ` +
      `data-track="${esc(t)}" aria-pressed="${t === viewed}">` +
      `${t ? esc(t) : 'No label'}${t === active ? ' <span class="dot" title="Active track">●</span>' : ''}` +
      `<small>${n} ${plural(n, 'entry', 'entries')}</small></button>`;
  }).join('');
  let html = `<div class="tracks" role="group" aria-label="Machine track">${chips}</div>`;
  if (viewed !== active) {
    html += `<div class="banner">Viewing ${viewed ? '“' + esc(viewed) + '”' : 'the unlabelled track'}, not your active track — logging is off here.` +
      (isEdit() && !x.archived ? ' ' + textBtn('Make it the active track', 'track-activate', x.id, 'link-btn inline') : '') + '</div>';
  }
  return html;
}

function trackTools(x) {
  if (!isEdit()) return '';
  const from = trackOf(x), n = state.logs.filter((l) => l.exerciseId === x.id && (l.machine || '') === from).length;
  if (!n) return '';
  if (state.ui.moveTrack !== x.id) {
    return '<div class="track-tools edit-only"><span class="meta">' +
      `${from ? esc(from) : 'No label'} · ${n} ${plural(n, 'entry', 'entries')}</span>` +
      textBtn('Rename or move entries…', 'track-move-open', x.id, 'link-btn inline') + '</div>';
  }
  const others = Array.from(new Set(machinesOf(x).concat(knownMachines()))).filter((m) => m !== from);
  return `<div class="track-form" data-form="trk:${x.id}">` +
    `<p class="track-q">Move the <b>${n}</b> ${plural(n, 'entry', 'entries')} of <b>${from ? esc(from) : 'No label'}</b> to:</p>` +
    `<input type="text" name="label" maxlength="${MAX_MACHINE_LEN}" list="track-options" placeholder="New name, existing track, or empty for no label" aria-label="New machine label">` +
    `<datalist id="track-options">${others.map((m) => (m ? `<option value="${esc(m)}">` : '')).join('')}</datalist>` +
    '<p class="help">A new name renames the track. The name of an existing track merges them into one.</p>' +
    '<div class="form-actions">' + textBtn('Move entries', 'track-move-save', x.id, 'btn primary sm') +
      textBtn('Cancel', 'cancel', '', 'btn secondary sm') + '</div><p class="err"></p></div>';
}

// ── Tonnage chart card ────────────────────────────────────────────────────────
function chartCard(x) {
  const ts = tonnageSeries(x, trackOf(x), bodyweightLookup());
  const folded = state.chartCollapsed.has(x.id);
  const shown = folded ? 0 : Math.min(ts.days.length, CHART_ENTRIES);
  const head = `<button class="chart-head" data-action="chart-toggle" data-id="${x.id}" aria-expanded="${!folded}">` +
    `${chevron(folded ? '' : ' open')}<span class="chart-title">Tonnage</span>` +
    `<span class="meta">last ${CHART_ENTRIES} sessions · kg</span></button>`;
  if (!ts.last) {
    return `<section class="card chart-card">${head}<p class="hist-empty">Log some entries on this track to see the chart.</p></section>`;
  }
  const change = ts.change === null ? '' :
    `<span class="delta ${ts.change >= 0 ? 'up' : 'down'}">${ts.change >= 0 ? '▲' : '▼'} ${Math.abs(ts.change).toFixed(1)}% vs previous</span>`;
  let note = '';
  if (x.bodyweight) {
    note = ts.bodyweightMissing
      ? '<p class="note warn">⚠ Bodyweight isn’t included yet. Log your weight in Bodyweight so tonnage counts it.</p>'
      : '<p class="note">Includes body weight (7-day average at each date)' +
        (ts.estimated ? ' · bars marked * use your first weigh-in (estimate)' : '') + '.</p>';
  }
  return `<section class="card chart-card">${head}` +
    `<div class="chart-sum"><strong>${formatTonnage(ts.last.total)} kg</strong>${change}</div>` +
    (shown ? `<div class="ex-chart-wrap"><canvas data-chart="${x.id}" role="img" aria-label="Tonnage per session, last ${shown} sessions"></canvas></div>` : '') +
    (folded ? '' : note) + '</section>';
}

// ── Sets and history ──────────────────────────────────────────────────────────
function histValues(l, s) {
  const sides = logSides(l);
  if (sides.length === 1) {
    return `<span class="hist-vals">${repsCell(sides[0].reps, s, true)}<span class="hist-wt">${formatWeight(sides[0].weight)} <small>kg</small></span></span>`;
  }
  return '<span class="hist-vals two">' + sides.map((sd, i) =>
    `<span class="side-line"><span class="side-tag">${i ? 'R' : 'L'}</span>${repsCell(sd.reps, s, true)}` +
    `<span class="hist-wt">${formatWeight(sd.weight)} <small>kg</small></span></span>`).join('') + '</span>';
}

function logRow(l, s) {
  if (state.ui.editLog === l.id) return logForm(l, 'logedit-save', l.id, { uni: !!l.left });
  return '<div class="hist-row">' +
    `<span class="hist-date">${l.date === today() ? 'Today' : formatDateShort(l.date)}</span>` +
    histValues(l, s) +
    '<span class="row-actions edit-only">' +
      iconBtn(ICON.edit, 'log-edit', l.id, 'Edit entry') +
      iconBtn(ICON.del, 'log-del', l.id, 'Delete entry', false, true) +
    '</span></div>';
}

function setHtml(x, s, k, canAdd) {
  const sk = x.id + ':' + s.id, hist = setLogs(x.id, s.id).reverse();
  const adding = state.ui.addFor === sk, expanded = state.showAll.has(sk);
  const shown = expanded ? hist : hist.slice(0, HISTORY_PREVIEW);
  let h = '<section class="set"><div class="set-head">' + setDot(k) +
    `<span class="set-name">Set ${k + 1}</span><span class="set-range">${rangeText(s)} reps</span>` +
    (adding || !canAdd ? '' : textBtn('+ Log', 'log-open', sk, 'log-btn')) + '</div>';
  if (adding) {
    const w = lastWeight(x, k);
    h += logForm({ date: today(), reps: '', weight: w }, 'log-save', sk, { uni: !!x.unilateral });
  }
  if (!hist.length && !adding) h += '<p class="hist-empty">No entries yet</p>';
  else if (hist.length) h += `<div class="hist">${shown.map((l) => logRow(l, s)).join('')}</div>`;
  if (hist.length > HISTORY_PREVIEW) {
    h += textBtn(expanded ? 'Show less' : 'Show all (' + hist.length + ')', 'hist-more', sk, 'link-btn');
  }
  return h + '</section>';
}

// ── The screen ────────────────────────────────────────────────────────────────
function exerciseScreen(x) {
  const day = findById(state.days, x.dayId), active = activeMachine(x);
  const done = exDoneToday(x);
  const sub = x.archived ? 'Archived' : day ? esc(day.name) : '';
  const editBtn = x.archived ? '' :
    '<span class="row-actions edit-only">' + iconBtn(ICON.edit, 'ex-edit', x.id, 'Edit exercise') + '</span>';
  const tags = (x.unilateral ? '<span class="tag">Unilateral</span>' : '') +
    (x.bodyweight ? '<span class="tag">Body weight</span>' : '') +
    (active ? `<span class="tag machine">${esc(active)}</span>` : '');
  const canAdd = canLog() && !x.archived && trackOf(x) === active;
  return backBar(esc(x.name), editBtn) +
    `<div class="dt-sub"><span class="meta">${sub}${done && !x.archived ? ' · done today ✓' : ''}</span>${tags}</div>` +
    (x.archived ? '<div class="banner">This exercise is archived. Restore it from the Archive to log again.</div>' : '') +
    trackSwitcher(x) + trackTools(x) + chartCard(x) +
    '<div class="sets-list">' + x.sets.map((s, k) => setHtml(x, s, k, canAdd)).join('') + '</div>';
}

export function detailHtml() {
  const ui = state.ui, v = state.view;
  if (ui.newExFor) return backBar('New exercise') + '<div class="dt-form">' + exerciseForm(null, ui.newExFor) + '</div>';
  if (v.kind !== 'ex') return null;
  if (!state.loaded) return backBar('Loading…');
  const x = findById(state.exercises, v.id);
  if (!x) return backBar('Exercise not found') + '<p class="empty">This exercise no longer exists.</p>';
  if (ui.editEx === x.id) return backBar('Edit exercise') + '<div class="dt-form">' + exerciseForm(x, x.dayId) + '</div>';
  return exerciseScreen(x);
}
