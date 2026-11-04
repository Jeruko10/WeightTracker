// What every data-action button in the Exercises section does. One delegated listener (see
// index.js) calls handleAction(); handlers update state, re-render, then persist.
import { byId } from '../../lib/dom.js';
import { confirmTap } from '../../lib/confirm-tap.js';
import { plural } from '../../lib/html.js';
import { showSnackbar } from '../../lib/snackbar.js';
import {
  state, isEdit, canLog, resetForms, closeAllForms, saveOpen, setFocusDay, saveChartCollapsed,
} from './state.js';
import { sortedDays, dayExercises, exDoneToday, findById, activeMachine, trackOf } from './selectors.js';
import { readLogForm, readDeloadDate, readExerciseForm, changeSetCount } from './form-readers.js';
import { toggleFold, openFold } from './folds.js';
import { playTreeEnter } from './modes.js';
import { goTo, exRoute } from './nav.js';
import { MAX_MACHINE_LEN } from './constants.js';
import { render } from './views/render.js';
import * as repo from './repository.js';

const { COLLECTIONS } = repo;
// How long a just-finished exercise stays open in Train before folding away.
const FOLD_DONE_MS = 500;

function focusIn(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.focus();
  if (el.select && el.type === 'text') el.select();
}

/** Opens one inline form (state.ui[slot] = id), re-renders and focuses its first field. */
function openForm(slot, id, formId, fieldName) {
  state.ui[slot] = id;
  render();
  focusIn(`[data-form="${formId}"] [name=${fieldName}]`);
}

/** Swaps an item with its neighbour and renumbers the list's `order`, saving what changed. */
function move(list, collection, id, dir) {
  const i = list.findIndex((o) => o.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const changed = [];
  list.forEach((o, k) => {
    if (o.order !== k) {
      o.order = k;
      changed.push(o);
    }
  });
  render();
  repo.saveOrder(collection, changed);
}

// ── Training days ─────────────────────────────────────────────────────────────
export function addDay() {
  const input = byId('new-day-name'), err = byId('new-day-err');
  const name = input.value.trim();
  if (!name) { err.textContent = 'Give the day a name.'; return; }
  if (!state.loaded) { err.textContent = 'Still loading, try again in a moment.'; return; }
  err.textContent = '';
  const order = state.days.length ? Math.max(...state.days.map((x) => x.order || 0)) + 1 : 0;
  const d = { id: repo.newId(COLLECTIONS.days), name, order, createdAt: Date.now() };
  state.days.push(d);
  openFold('d:' + d.id);
  input.value = '';
  render();
  repo.saveDay(d);
}

// ── Logging a set (Edit and Train) ────────────────────────────────────────────
function saveNewLog(id, form) {
  const v = readLogForm(form);
  if (!v) return;
  const [exerciseId, setId] = id.split(':');
  const x = findById(state.exercises, exerciseId);
  const wasDone = !!x && exDoneToday(x);
  // New entries are stamped with the exercise's active machine label.
  const log = {
    id: repo.newId(COLLECTIONS.logs), exerciseId, setId, ...v, machine: x ? activeMachine(x) : '', createdAt: Date.now(),
  };
  state.logs.push(log);
  state.ui.addFor = null;
  // In Train, logging the last pending set finishes the exercise: show its ✓, then fold it.
  if (state.mode === 'train' && x && !wasDone && exDoneToday(x)) {
    state.focusExpanded.delete(x.id);
    state.justCompleted = x.id;
    render();
    state.justCompleted = null;
    setTimeout(() => {
      const box = document.querySelector(`#ex-tree [data-key="f:${x.id}"]`);
      if (box && !state.focusExpanded.has(x.id)) {
        box.classList.remove('open');
        box.querySelector('.focus-ex-head').setAttribute('aria-expanded', 'false');
      }
    }, FOLD_DONE_MS);
  } else {
    render();
  }
  repo.saveLog(log);
}

// ── Handlers ──────────────────────────────────────────────────────────────────
// Each receives { t: the clicked element, id: its data-id, f: its enclosing form }.

/** Allowed in every mode (logging itself checks canLog: never in read-only View). */
const ANY_MODE = {
  toggle: ({ t }) => toggleFold(t.closest('.foldable')),
  cancel: () => { closeAllForms(); render(); },
  'ex-open': ({ id }) => goTo(exRoute(id)),
  'chart-toggle': ({ id }) => {
    if (state.chartCollapsed.has(id)) state.chartCollapsed.delete(id);
    else state.chartCollapsed.add(id);
    saveChartCollapsed();
    render();
  },
  // Train: change today's machine label (starts or resumes that machine's track).
  'train-machine': ({ id }) => {
    if (!canLog()) return;
    closeAllForms();
    openForm('machineFor', id, 'mach:' + id, 'machine');
  },
  'train-machine-save': ({ id, f }) => {
    const x = findById(state.exercises, id);
    if (!x || !canLog()) return;
    x.machine = f.querySelector('[name=machine]').value.trim().slice(0, MAX_MACHINE_LEN);
    delete state.track[id];
    state.ui.machineFor = null;
    render();
    repo.saveExercise(x);
  },
  'archive-open': () => goTo('archive'),
  'detail-back': () => {
    // Backing out of a form returns to the screen under it; otherwise to the list.
    if (state.ui.newExFor || state.ui.editEx) {
      closeAllForms();
      render();
    } else {
      goTo('');
    }
  },
  'track-pick': ({ t, id }) => {
    state.track[id] = t.dataset.track;
    closeAllForms();
    render();
  },
  'hist-more': ({ id }) => {
    if (state.showAll.has(id)) state.showAll.delete(id);
    else state.showAll.add(id);
    render();
  },

  'log-open': ({ id }) => {
    if (!canLog()) return;
    resetForms();
    state.ui.addFor = id;
    render();
    focusIn(`[data-form="${id}"] [name=reps]`);
  },
  'log-save': ({ id, f }) => {
    if (canLog()) saveNewLog(id, f);
  },

  'focus-fold': ({ t, id }) => {
    const box = t.closest('.foldable'), isOpen = !box.classList.contains('open');
    box.classList.toggle('open', isOpen);
    t.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) state.focusExpanded.add(id);
    else state.focusExpanded.delete(id);
  },
  'focus-pick': ({ id }) => {
    setFocusDay(id);
    state.focusExpanded.clear();
    closeAllForms();
    render();
    playTreeEnter();
    window.scrollTo(0, 0);
  },
  'focus-change': () => {
    setFocusDay(null);
    state.ui.addFor = null;
    render();
    playTreeEnter();
  },
};

/** Structure and history changes: Edit mode only. */
const EDIT_ONLY = {
  // Deloads
  'deload-add': ({ f }) => {
    const date = readDeloadDate(f, null);
    if (!date) return;
    const d = { id: repo.newId(COLLECTIONS.deloads), date, createdAt: Date.now() };
    state.deloads.push(d);
    openFold('deload');
    render();
    repo.saveDeload(d);
  },
  'deload-edit': ({ id }) => {
    closeAllForms();
    openForm('editDeload', id, 'deload:' + id, 'date');
  },
  'deloadedit-save': ({ id, f }) => {
    const d = findById(state.deloads, id), date = readDeloadDate(f, id);
    if (!d || !date) return;
    d.date = date;
    state.ui.editDeload = null;
    render();
    repo.updateDeloadDate(id, date);
  },
  'deload-del': ({ id }) => {
    const d = findById(state.deloads, id);
    if (!d) return;
    state.deloads = state.deloads.filter((o) => o.id !== id);
    render();
    repo.deleteDeload(id);
    showSnackbar('Deload date removed', {
      label: 'Undo',
      run: () => {
        state.deloads.push(d);
        render();
        repo.saveDeload(d);
      },
    });
  },

  // Logged sets
  'log-edit': ({ id }) => {
    closeAllForms();
    openForm('editLog', id, id, 'reps');
  },
  'logedit-save': ({ id, f }) => {
    const log = findById(state.logs, id), v = readLogForm(f);
    if (!log || !v) return;
    Object.assign(log, v);
    state.ui.editLog = null;
    render();
    repo.saveLog(log);
  },
  'log-del': ({ id }) => {
    const log = findById(state.logs, id);
    if (!log) return;
    state.logs = state.logs.filter((o) => o.id !== id);
    render();
    repo.deleteLog(id);
    showSnackbar('Entry deleted', {
      label: 'Undo',
      run: () => {
        state.logs.push(log);
        render();
        repo.saveLog(log);
      },
    });
  },

  // Training days
  'day-up': ({ id }) => move(sortedDays(), COLLECTIONS.days, id, -1),
  'day-down': ({ id }) => move(sortedDays(), COLLECTIONS.days, id, 1),
  'day-edit': ({ id }) => {
    resetForms();
    openForm('editDay', id, 'day:' + id, 'name');
  },
  'day-rename-save': ({ id, f }) => {
    const d = findById(state.days, id), name = f.querySelector('[name=name]').value.trim();
    if (!d || !name) return;
    d.name = name;
    state.ui.editDay = null;
    render();
    repo.renameDay(id, name);
  },
  'day-del': ({ t, id }) => {
    const exs = state.exercises.filter((o) => o.dayId === id);
    const exIds = new Set(exs.map((o) => o.id));
    const logs = state.logs.filter((o) => exIds.has(o.exerciseId));
    const label = exs.length ? `Delete day + ${exs.length} ${plural(exs.length, 'exercise')}?` : 'Delete?';
    if (!confirmTap(t, label)) return;
    state.days = state.days.filter((o) => o.id !== id);
    state.exercises = state.exercises.filter((o) => o.dayId !== id);
    state.logs = state.logs.filter((o) => !exIds.has(o.exerciseId));
    render();
    repo.deleteDayCascade(id, exs, logs);
  },

  // Exercises
  'ex-new': ({ id }) => {
    resetForms();
    state.open.add('d:' + id);
    saveOpen();
    openForm('newExFor', id, 'new:' + id, 'name');
  },
  'sets-inc': ({ f }) => changeSetCount(f, 1),
  'sets-dec': ({ f }) => changeSetCount(f, -1),
  'ex-create': ({ id, f }) => {
    const v = readExerciseForm(f);
    if (!v) return;
    const siblings = dayExercises(id);
    const order = siblings.length ? siblings[siblings.length - 1].order + 1 : 0;
    const x = {
      id: repo.newId(COLLECTIONS.exercises), dayId: id, name: v.name, order, sets: v.sets,
      unilateral: v.unilateral, bodyweight: v.bodyweight, machine: v.machine, archived: false,
    };
    state.exercises.push(x);
    state.ui.newExFor = null;
    openFold('e:' + x.id);
    render();
    repo.saveExercise(x);
  },
  'ex-up': ({ id }) => moveExercise(id, -1),
  'ex-down': ({ id }) => moveExercise(id, 1),
  'ex-edit': ({ id }) => {
    closeAllForms();
    goTo(exRoute(id), { slot: 'editEx', id });
  },
  'track-activate': ({ id }) => {
    const x = findById(state.exercises, id);
    if (!x) return;
    x.machine = trackOf(x);
    delete state.track[id];
    render();
    repo.saveExercise(x);
  },
  'ex-archive': ({ id }) => {
    const x = findById(state.exercises, id);
    if (!x) return;
    const prev = { dayId: x.dayId, order: x.order };
    x.archived = true;
    x.dayId = null;
    delete state.track[id];
    closeAllForms();
    if (state.view.kind === 'ex') goTo('');
    else render();
    repo.saveExercise(x);
    showSnackbar(x.name + ' archived', {
      label: 'Undo',
      run: () => {
        // The day may have been deleted meanwhile: then it stays archived.
        if (!findById(state.days, prev.dayId)) return;
        x.archived = false;
        x.dayId = prev.dayId;
        x.order = prev.order;
        render();
        repo.saveExercise(x);
      },
    });
  },
  'ex-restore': ({ t, id }) => {
    const x = findById(state.exercises, id), sel = t.closest('.arch-row').querySelector('select');
    if (!x || !sel || !sel.value) return;
    const siblings = dayExercises(sel.value);
    x.order = siblings.length ? siblings[siblings.length - 1].order + 1 : 0;
    x.dayId = sel.value;
    x.archived = false;
    openFold('d:' + x.dayId);
    render();
    repo.saveExercise(x);
  },
  'ex-save': ({ t, id, f }) => {
    const x = findById(state.exercises, id), v = readExerciseForm(f);
    if (!x || !v) return;
    const keep = new Set(v.sets.map((s) => s.id));
    const dropped = state.logs.filter((o) => o.exerciseId === id && !keep.has(o.setId));
    // Removing a set takes its history with it — make that an explicit second tap.
    const label = `Deletes ${dropped.length} logged ${plural(dropped.length, 'entry', 'entries')}. Tap again`;
    if (dropped.length && !confirmTap(t, label)) return;
    x.name = v.name;
    x.sets = v.sets;
    x.unilateral = v.unilateral;
    x.bodyweight = v.bodyweight;
    // A new label starts a new track: follow it instead of staying on the old one.
    if ((x.machine || '') !== v.machine) delete state.track[id];
    x.machine = v.machine;
    const dropIds = new Set(dropped.map((o) => o.id));
    state.logs = state.logs.filter((o) => !dropIds.has(o.id));
    state.ui.editEx = null;
    render();
    repo.saveExerciseDroppingLogs(x, dropped);
  },
  'ex-del': ({ t, id }) => {
    const logs = state.logs.filter((o) => o.exerciseId === id);
    const label = logs.length ? `Delete + ${logs.length} ${plural(logs.length, 'entry', 'entries')}?` : 'Delete?';
    if (!confirmTap(t, label)) return;
    state.exercises = state.exercises.filter((o) => o.id !== id);
    state.logs = state.logs.filter((o) => o.exerciseId !== id);
    delete state.track[id];
    state.open.delete('e:' + id);
    closeAllForms();
    if (state.view.kind === 'ex' && state.view.id === id) goTo('');
    else render();
    repo.deleteExerciseCascade(id, logs);
  },
};

function moveExercise(id, dir) {
  const x = findById(state.exercises, id);
  if (x) move(dayExercises(x.dayId), COLLECTIONS.exercises, id, dir);
}

export function handleAction(t) {
  const action = t.dataset.action;
  const ctx = { t, id: t.dataset.id, f: t.closest('[data-form]') };
  if (ANY_MODE[action]) ANY_MODE[action](ctx);
  else if (EDIT_ONLY[action] && isEdit()) EDIT_ONLY[action](ctx);
}
