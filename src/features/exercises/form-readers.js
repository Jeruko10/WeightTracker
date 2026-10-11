// Reads and validates the inline forms. Each reader returns the clean values, or null after
// showing the problem in the form's own .err line.
import { MAX_REPS, MIN_REPS, MAX_SETS, MIN_SETS, MAX_ABS_WEIGHT } from './constants.js';
import { state } from './state.js';
import { rangeRow } from './views/forms.js';

function fail(form, msg) {
  form.querySelector('.err').textContent = msg;
  return null;
}

const field = (form, name) => form.querySelector(`[name=${name}]`);

export function readLogForm(f) {
  const date = field(f, 'date').value;
  const repsRaw = field(f, 'reps').value, weightRaw = field(f, 'weight').value;
  const reps = Number(repsRaw), weight = weightRaw === '' ? 0 : Number(weightRaw);
  if (!date) return fail(f, 'Pick a date.');
  if (repsRaw === '' || !Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) {
    return fail(f, 'Reps must be a whole number from 0 to ' + MAX_REPS + '.');
  }
  // Negative weight is allowed for assisted lifts (e.g. -20 kg on an assisted pull-up).
  if (!isFinite(weight) || weight < -MAX_ABS_WEIGHT || weight > MAX_ABS_WEIGHT) {
    return fail(f, `Weight must be between -${MAX_ABS_WEIGHT} and ${MAX_ABS_WEIGHT} kg.`);
  }
  return { date, reps, weight: Math.round(weight * 100) / 100 };
}

/** `selfId`: the deload being edited, so keeping its own date doesn't count as a duplicate. */
export function readDeloadDate(f, selfId) {
  const date = field(f, 'date').value;
  if (!date) return fail(f, 'Pick a date.');
  if (state.deloads.some((o) => o.date === date && o.id !== selfId)) {
    return fail(f, 'That date is already marked as a deload start.');
  }
  return date;
}

function readRangeRows(f) {
  return Array.from(f.querySelectorAll('.range-row')).map((r) => ({
    id: r.dataset.setId, min: field(r, 'min').value, max: field(r, 'max').value,
  }));
}

/** The exercise form's −/+ stepper: adds a set copying the last range, or drops the last. */
export function changeSetCount(f, delta) {
  const rows = readRangeRows(f);
  if (delta > 0 && rows.length < MAX_SETS) {
    const last = rows[rows.length - 1];
    rows.push({ id: '', min: last.min, max: last.max });
  }
  if (delta < 0 && rows.length > MIN_SETS) rows.pop();
  f.querySelector('.range-rows').innerHTML = rows.map(rangeRow).join('');
  f.querySelector('.step-val').textContent = rows.length;
  f.querySelector('[data-action=sets-dec]').disabled = rows.length <= MIN_SETS;
  f.querySelector('[data-action=sets-inc]').disabled = rows.length >= MAX_SETS;
}

// A short random id for a new set — only needs to be unique within its exercise.
function newSetId() {
  return Math.random().toString(36).slice(2, 10);
}

export function readExerciseForm(f) {
  const name = field(f, 'name').value.trim();
  if (!name) return fail(f, 'Give the exercise a name.');
  const rows = readRangeRows(f), sets = [];
  if (rows.length < MIN_SETS || rows.length > MAX_SETS) return fail(f, `Between ${MIN_SETS} and ${MAX_SETS} sets.`);
  for (let k = 0; k < rows.length; k++) {
    const mn = Number(rows[k].min), mx = Number(rows[k].max), lbl = 'Set ' + (k + 1) + ': ';
    if (rows[k].min === '' || rows[k].max === '' || !Number.isInteger(mn) || !Number.isInteger(mx)) {
      return fail(f, lbl + 'enter whole numbers for the rep range.');
    }
    if (mn < MIN_REPS || mx > MAX_REPS) return fail(f, lbl + 'reps must be between ' + MIN_REPS + ' and ' + MAX_REPS + '.');
    if (mn > mx) return fail(f, lbl + 'min can\'t be greater than max.');
    sets.push({ id: rows[k].id || newSetId(), min: mn, max: mx });
  }
  return { name, sets };
}
