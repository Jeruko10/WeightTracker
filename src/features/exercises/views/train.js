// Train mode: one training day and nothing else — each set's range, its latest reps and weight,
// and a button to log. No folds except finished exercises, no charts. Logs are always for today.
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
import { logForm } from './forms.js';

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
  tree.innerHTML = '<div class="focus-wrap">' +
    (exs.length ? exs.map(exerciseHtml).join('') : '<p class="empty">No exercises in this day yet.</p>') +
    '</div>';
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
