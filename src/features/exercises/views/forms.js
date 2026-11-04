// Inline forms: log a set, create/edit an exercise. Read back by form-readers.js.
import { esc } from '../../../lib/html.js';
import {
  MAX_REPS, MIN_REPS, MAX_SETS, MIN_SETS, MAX_ABS_WEIGHT, DEFAULT_SET, DEFAULT_SET_COUNT, MAX_MACHINE_LEN, ICON,
} from '../constants.js';
import { knownMachines } from '../selectors.js';
import { saveCancel, textBtn, setDot } from './components.js';

const ERR = '<p class="err"></p>';

function repsInput(value, name = 'reps') {
  return `<label><span class="field-label">Reps</span><input type="number" name="${name}" inputmode="numeric" ` +
    `min="0" max="${MAX_REPS}" step="1" value="${value}"></label>`;
}

function weightInput(value, name = 'weight', disabled = false) {
  return `<label><span class="field-label">Weight (kg)</span><input type="number" name="${name}" ` +
    `min="-${MAX_ABS_WEIGHT}" max="${MAX_ABS_WEIGHT}" step="0.25" value="${value}"${disabled ? ' disabled' : ''}></label>`;
}

/** The reps + weight inputs of a log: one pair, or a Left and a Right pair for unilateral logs. */
function sidesFields(v, uni) {
  if (!uni) return `<div class="lf-pair">${repsInput(v.reps)}${weightInput(v.weight)}</div>`;
  const l = v.left || { reps: '', weight: v.weight === undefined ? '' : v.weight };
  const r = v.right || { reps: '', weight: l.weight };
  const same = !v.right || r.weight === l.weight;
  return '<div class="lf-side"><span class="side-tag">L</span>' +
      `<div class="lf-pair">${repsInput(l.reps, 'reps-l')}${weightInput(l.weight, 'weight-l')}</div></div>` +
    '<div class="lf-side"><span class="side-tag">R</span>' +
      `<div class="lf-pair">${repsInput(r.reps, 'reps-r')}${weightInput(r.weight, 'weight-r', same)}</div></div>` +
    `<label class="check-row compact"><input type="checkbox" name="same"${same ? ' checked' : ''}>` +
      '<span>Same weight on both sides</span></label>';
}

/**
 * Log form. `v` holds the initial values ({ date, reps, weight } or, for unilateral logs,
 * { date, left, right }); `id` is what data-form points at. `focus`: Train mode's variant, which
 * has no date field (it always logs for today).
 */
export function logForm(v, action, id, { uni = false, focus = false } = {}) {
  const date = focus
    ? `<input type="hidden" name="date" value="${v.date}">`
    : `<label class="lf-date"><span class="field-label">Date</span><input type="date" name="date" value="${v.date}"></label>`;
  return `<div class="log-form${focus ? ' focus-form' : ''}" data-form="${id}"${uni ? ' data-uni="1"' : ''}>` +
    date + sidesFields(v, uni) +
    `<div class="form-actions">${saveCancel('Save', action, id)}</div>` +
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

function checkRow(name, checked, title, help) {
  return `<label class="check-row"><input type="checkbox" name="${name}"${checked ? ' checked' : ''}>` +
    `<span><b>${title}</b><small>${help}</small></span></label>`;
}

/** Create (x null) or edit an exercise: name, machine, sets and ranges, options. */
export function exerciseForm(x, dayId) {
  const sets = x ? x.sets : Array.from({ length: DEFAULT_SET_COUNT }, () => ({ id: '', ...DEFAULT_SET }));
  const submit = x
    ? textBtn('Save changes', 'ex-save', x.id, 'btn primary sm')
    : textBtn('Add exercise', 'ex-create', dayId, 'btn primary sm');
  const danger = x
    ? '<div class="danger-zone"><span class="field-label">Danger zone</span>' +
        `<div class="form-actions">${textBtn(ICON.archive + ' Archive exercise', 'ex-archive', x.id, 'btn secondary sm')}` +
        `${textBtn('Delete exercise', 'ex-del', x.id, 'btn danger sm')}</div>` +
        '<p class="help">Archiving keeps every logged entry; you can restore it later into any day.</p></div>'
    : '';
  return `<div class="ex-form" data-form="${x ? 'ex:' + x.id : 'new:' + dayId}">` +
    '<label><span class="field-label">Exercise name</span>' +
      `<input type="text" name="name" maxlength="60" placeholder="e.g. Bench press" value="${x ? esc(x.name) : ''}"></label>` +
    '<label><span class="field-label">Machine or variant <small>(optional)</small></span>' +
      `<input type="text" name="machine" maxlength="${MAX_MACHINE_LEN}" list="machine-options" ` +
      `placeholder="e.g. Hammer Strength" value="${x ? esc(x.machine || '') : ''}"></label>` +
    `<datalist id="machine-options">${knownMachines().map((m) => `<option value="${esc(m)}">`).join('')}</datalist>` +
    '<p class="help">New entries are tagged with this label. Changing it starts a separate track; ' +
      'the history under the old label stays available.</p>' +
    '<div class="sets-ctl"><span class="field-label">Sets <small>(target rep range per set)</small></span>' +
      '<div class="stepper">' +
        `<button class="step-btn" data-action="sets-dec" aria-label="Remove a set"${sets.length <= MIN_SETS ? ' disabled' : ''}>−</button>` +
        `<span class="step-val">${sets.length}</span>` +
        `<button class="step-btn" data-action="sets-inc" aria-label="Add a set"${sets.length >= MAX_SETS ? ' disabled' : ''}>+</button>` +
      '</div></div>' +
    `<div class="range-rows">${sets.map(rangeRow).join('')}</div>` +
    '<div class="options"><span class="field-label">Options</span>' +
      checkRow('unilateral', x && x.unilateral, 'Unilateral', 'Each set records the left and right side separately.') +
      checkRow('bodyweight', x && x.bodyweight, 'Body weight exercise',
        'Adds your 7-day average body weight to the logged weight when calculating tonnage.') +
    '</div>' +
    `<div class="form-actions">${submit}${textBtn('Cancel', 'cancel', '', 'btn secondary sm')}</div>` +
    ERR + danger + '</div>';
}
