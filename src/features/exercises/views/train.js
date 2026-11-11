// Logs here are always for today.
import { byId } from '../../../lib/dom.js';
import { today, formatDateShort } from '../../../lib/dates.js';
import { esc, plural } from '../../../lib/html.js';
import { ICON, chevron } from '../constants.js';
import { state, setFocusDay } from '../state.js';
import { MAX_MACHINE_LEN } from '../constants.js';
import {
  sortedDays, dayExercises, rangeText, lastWeight, exDoneToday, formatWeight, findById, lastLog, logSides, activeMachine,
  knownMachines,
} from '../selectors.js';
import { textBtn, setDot, repsCell } from './components.js';
import { currentDeload, cyclePhase } from '../deloads.js';
import { logForm } from './forms.js';

// ── Rest clock ────────────────────────────────────────────────────────────────
// A quiet "Rest 1:42" since the last set logged today. No alarm, no countdown: just the number.
const REST_HIDE_MS = 2 * 60 * 60 * 1000; // after 2 h it is a new session, not a rest
let restTimer = null;

function lastSetTime() {
  const t = today();
  let last = 0;
  state.logs.forEach((l) => { if (l.date === t && (l.createdAt || 0) > last) last = l.createdAt; });
  return last;
}

function tickRest() {
  const el = byId('focus-rest');
  if (!el) return;
  const last = lastSetTime(), ms = Date.now() - last;
  if (!last || ms < 0 || ms > REST_HIDE_MS) {
    el.textContent = '';
    return;
  }
  const s = Math.floor(ms / 1000);
  el.textContent = 'Rest ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' since your last set';
}

export function stopRest() {
  clearInterval(restTimer);
  restTimer = null;
}

function startRest() {
  stopRest();
  tickRest();
  restTimer = setInterval(tickRest, 1000);
}

export function renderTrain(tree) {
  const title = byId('focus-title');
  const day = findById(state.days, state.focusDay);
  if (!day) {
    if (state.focusDay) setFocusDay(null);
    title.innerHTML = '<span class="focus-day">Train</span>';
    tree.innerHTML = dayPickerHtml();
    return;
  }
  title.innerHTML = `<span class="focus-day">${esc(day.name)}</span>` +
    textBtn('Change day', 'focus-change', '', 'link-btn focus-change');
  const exs = dayExercises(day.id);
  // The deload cycle matters when picking weights, so its phase sits above the exercises.
  const cur = currentDeload(), phase = cur ? cyclePhase(cur) : null;
  const phaseLine = phase
    ? `<p class="focus-phase${phase.isDeload ? ' deload' : ''}">${esc(phase.text)}</p>` : '';
  tree.innerHTML = '<div class="focus-wrap">' + phaseLine + '<p class="focus-rest" id="focus-rest"></p>' +
    (exs.length ? exs.map(exerciseHtml).join('') : '<p class="empty">No exercises in this day yet.</p>') +
    '</div>';
  startRest();
}

function dayPickerHtml() {
  const days = sortedDays();
  const picks = days.length
    ? days.map((d) => {
      const n = dayExercises(d.id).length;
      return `<button class="focus-pick" data-action="focus-pick" data-id="${d.id}">` +
        `<span class="fp-name">${esc(d.name)}</span><span class="meta">${n} ${plural(n, 'exercise')}</span></button>`;
    }).join('')
    : '<p class="empty">No training days yet. Switch to Edit mode to create one.</p>';
  return '<div class="focus-wrap"><div><p class="focus-prompt">Choose a day to train</p>' +
    `<div class="focus-days">${picks}</div></div></div>`;
}

function machineForm(x) {
  return `<div class="machine-form" data-form="mach:${x.id}">` +
    '<label><span class="field-label">Machine today</span>' +
      `<input type="text" name="machine" maxlength="${MAX_MACHINE_LEN}" list="machine-options" value="${esc(x.machine || '')}" placeholder="No label"></label>` +
    `<datalist id="machine-options">${knownMachines().map((m) => `<option value="${esc(m)}">`).join('')}</datalist>` +
    '<p class="help">New sets today are tracked under this label. Past sets stay in their own track.</p>' +
    '<div class="form-actions">' + textBtn('Save', 'train-machine-save', x.id, 'btn primary sm') +
      textBtn('Cancel', 'cancel', '', 'btn secondary sm') + '</div></div>';
}

// Finished exercises fold away on their own (the user can reopen them); pending ones always
// stay open.
function exerciseHtml(x) {
  const sets = `<div class="focus-sets">${x.sets.map((s, k) => setHtml(x, s, k)).join('')}</div>`;
  const machine = activeMachine(x);
  const plainName = `<span class="focus-ex-name">${esc(x.name)}` +
    (machine ? `<span class="tag machine">${esc(machine)}</span>` : '') + '</span>';
  if (!exDoneToday(x)) {
    // Pending exercises show the machine as a button: the gym may have swapped it today.
    const label = machine ? esc(machine) : '+ Machine';
    const tagBtn = `<button class="tag machine tag-btn${machine ? '' : ' empty'}" data-action="train-machine" data-id="${x.id}" ` +
      `aria-label="Machine today: ${machine ? esc(machine) : 'none'}. Change">${label}</button>`;
    const name = `<span class="focus-ex-name">${esc(x.name)}${tagBtn}</span>`;
    return `<section class="focus-ex"><div class="focus-ex-head"><span></span>${name}<span></span></div>` +
      (state.ui.machineFor === x.id ? machineForm(x) : '') + sets + '</section>';
  }
  const name = plainName;
  // The exercise just finished renders open, then folds shut so the collapse is seen happening.
  const isOpen = state.focusExpanded.has(x.id) || state.justCompleted === x.id;
  return `<section class="focus-ex done foldable${isOpen ? ' open' : ''}" data-key="f:${x.id}">` +
    `<button class="fold-head focus-ex-head" data-action="focus-fold" data-id="${x.id}" aria-expanded="${isOpen}">` +
      `<span class="focus-ex-check" title="All sets done today">${ICON.check}</span>${name}${chevron()}</button>` +
    `<div class="fold"><div class="fold-inner">${sets}</div></div></section>`;
}

function lastLogHtml(last, s) {
  if (!last) return '<span class="focus-none">No entries yet</span>';
  const doneToday = last.date === today();
  const sides = logSides(last).map((sd, i, all) =>
    '<span class="focus-side">' + (all.length > 1 ? `<span class="side-tag">${i ? 'R' : 'L'}</span>` : '') +
    repsCell(sd.reps, s, false) + `<span class="focus-wt">${formatWeight(sd.weight)} <small>kg</small></span></span>`).join('');
  return `<span class="focus-sides">${sides}</span>` +
    `<span class="focus-today" title="${doneToday ? 'Logged today' : 'Last: ' + formatDateShort(last.date)}">` +
      (doneToday ? ICON.check : formatDateShort(last.date).slice(0, 5)) + '</span>';
}

function setHtml(x, s, k) {
  const sk = x.id + ':' + s.id, last = lastLog(x, s);
  const doneToday = !!last && last.date === today(), adding = state.ui.addFor === sk;
  const label = 'Log set ' + (k + 1);
  let html = `<div class="focus-set${doneToday ? ' done' : ''}">` + setDot(k) +
    `<div class="focus-set-label"><span class="set-name">Set ${k + 1}</span><span class="set-range">${rangeText(s)} reps</span></div>` +
    `<div class="focus-last">${lastLogHtml(last, s)}</div>` +
    (adding ? '' : `<button class="focus-add" data-action="log-open" data-id="${sk}" aria-label="${label}" title="${label}">${ICON.plus}</button>`) +
    '</div>';
  if (adding) html += logForm({ date: today(), reps: '', weight: lastWeight(x, k) }, 'log-save', sk, { uni: !!x.unilateral, focus: true });
  return html;
}
