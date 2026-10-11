// Inline forms: log a set, create/edit an exercise. Read back by form-readers.js.
import { esc } from '../../../lib/html.js';
import {
  MAX_REPS, MIN_REPS, MAX_SETS, MIN_SETS, MAX_ABS_WEIGHT, DEFAULT_SET, DEFAULT_SET_COUNT,
} from '../constants.js';
import { saveCancel, textBtn, setDot } from './components.js';

const ERR = '<p class="err"></p>';

function repsInput(value) {
  return `<label><span class="field-label">Reps</span><input type="number" name="reps" inputmode="numeric" ` +
    `min="0" max="${MAX_REPS}" step="1" value="${value}"></label>`;
}

function weightInput(value) {
  return `<label><span class="field-label">Weight (kg)</span><input type="number" name="weight" ` +
    `min="-${MAX_ABS_WEIGHT}" max="${MAX_ABS_WEIGHT}" step="0.25" value="${value}"></label>`;
}

/** Date + reps + weight. `v` holds the initial values; `id` is what data-form points at. */
export function logForm(v, action, id) {
  return `<div class="log-form" data-form="${id}">` +
    '<div class="lf-grid">' +
      `<label class="lf-date"><span class="field-label">Date</span><input type="date" name="date" value="${v.date}"></label>` +
      repsInput(v.reps) + weightInput(v.weight) +
    '</div>' +
    `<div class="form-actions">${saveCancel('Save', action, id)}</div>` +
    ERR + '</div>';
}

/** Train mode's log form: no date field, it always logs for today. */
export function focusLogForm(date, weight, id) {
  return `<div class="log-form focus-form" data-form="${id}">` +
    `<input type="hidden" name="date" value="${date}">` +
    `<div class="focus-form-grid">${repsInput('')}${weightInput(weight)}</div>` +
    `<div class="form-actions">${saveCancel('Save', 'log-save', id)}</div>` +
    ERR + '</div>';
}

export function rangeRow(s, k) {
  const repsAttrs = `inputmode="numeric" min="${MIN_REPS}" max="${MAX_REPS}" step="1"`;
  return `<div class="range-row" data-set-id="${s.id || ''}">` +
    setDot(k) +
    `<span class="range-label">Set ${k + 1}</span>` +
    `<input type="number" name="min" ${repsAttrs} value="${s.min}" aria-label="Set ${k + 1} min reps">` +
    '<span class="range-sep">–</span>' +
    `<input type="number" name="max" ${repsAttrs} value="${s.max}" aria-label="Set ${k + 1} max reps">` +
    '<span class="range-unit">reps</span></div>';
}

/** Create (x null) or edit an exercise: name, set count stepper and a rep range per set. */
export function exerciseForm(x, dayId) {
  const sets = x ? x.sets : Array.from({ length: DEFAULT_SET_COUNT }, () => ({ id: '', ...DEFAULT_SET }));
  const submit = x
    ? textBtn('Save changes', 'ex-save', x.id, 'btn primary sm')
    : textBtn('Add exercise', 'ex-create', dayId, 'btn primary sm');
  return `<div class="ex-form" data-form="${x ? 'ex:' + x.id : 'new:' + dayId}">` +
    '<label><span class="field-label">Exercise name</span>' +
      `<input type="text" name="name" maxlength="60" placeholder="e.g. Bench press" value="${x ? esc(x.name) : ''}"></label>` +
    '<div class="sets-ctl"><span class="field-label">Sets <small>(target rep range per set)</small></span>' +
      '<div class="stepper">' +
        `<button class="step-btn" data-action="sets-dec" aria-label="Remove a set"${sets.length <= MIN_SETS ? ' disabled' : ''}>−</button>` +
        `<span class="step-val">${sets.length}</span>` +
        `<button class="step-btn" data-action="sets-inc" aria-label="Add a set"${sets.length >= MAX_SETS ? ' disabled' : ''}>+</button>` +
      '</div></div>' +
    `<div class="range-rows">${sets.map(rangeRow).join('')}</div>` +
    `<div class="form-actions">${submit}${textBtn('Cancel', 'cancel', '', 'btn secondary sm')}</div>` +
    ERR + '</div>';
}
