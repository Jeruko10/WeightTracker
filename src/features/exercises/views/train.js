// Train mode: one training day and nothing else — each set's range, its latest reps and weight,
// and a button to log. No folds except finished exercises, no charts. Logs are always for today.
import { byId } from '../../../lib/dom.js';
import { today, formatDateShort } from '../../../lib/dates.js';
import { esc, plural } from '../../../lib/html.js';
import { ICON, chevron } from '../constants.js';
import { state, setFocusDay } from '../state.js';
import { sortedDays, dayExercises, setLogs, rangeText, lastWeight, exDoneToday, formatWeight, findById } from '../selectors.js';
import { textBtn, setDot } from './components.js';
import { focusLogForm } from './forms.js';
import { repsCell } from './tree.js';

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

// Finished exercises fold away on their own (the user can reopen them); pending ones always
// stay open.
function exerciseHtml(x) {
  const sets = `<div class="focus-sets">${x.sets.map((s, k) => setHtml(x, s, k)).join('')}</div>`;
  const name = `<span class="focus-ex-name">${esc(x.name)}</span>`;
  if (!exDoneToday(x)) {
    return `<section class="focus-ex"><div class="focus-ex-head"><span></span>${name}<span></span></div>${sets}</section>`;
  }
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
  return repsCell(last.reps, s, false) +
    `<span class="focus-wt">${formatWeight(last.weight)} <small>kg</small></span>` +
    `<span class="focus-today" title="${doneToday ? 'Logged today' : 'Last: ' + formatDateShort(last.date)}">` +
      (doneToday ? ICON.check : formatDateShort(last.date).slice(0, 5)) + '</span>';
}

function setHtml(x, s, k) {
  const sk = x.id + ':' + s.id, h = setLogs(x.id, s.id), last = h.length ? h[h.length - 1] : null;
  const doneToday = !!last && last.date === today(), adding = state.ui.addFor === sk;
  const label = 'Log set ' + (k + 1);
  let html = `<div class="focus-set${doneToday ? ' done' : ''}">` + setDot(k) +
    `<div class="focus-set-label"><span class="set-name">Set ${k + 1}</span><span class="set-range">${rangeText(s)} reps</span></div>` +
    `<div class="focus-last">${lastLogHtml(last, s)}</div>` +
    (adding ? '' : `<button class="focus-add" data-action="log-open" data-id="${sk}" aria-label="${label}" title="${label}">${ICON.plus}</button>`) +
    '</div>';
  if (adding) html += focusLogForm(today(), lastWeight(x, k), sk);
  return html;
}
