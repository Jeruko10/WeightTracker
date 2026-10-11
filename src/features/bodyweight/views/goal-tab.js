// The Goal tab: set/replace/remove the active goal with a live preview, the current goal's
// summary, and the list of past goals.
import { byId, setVisible } from '../../../lib/dom.js';
import { WEEK_MS, today, formatDate } from '../../../lib/dates.js';
import { confirmTap } from '../../../lib/confirm-tap.js';
import { state, latestWeight } from '../state.js';
import { planGoal, goalStartWeight, archiveGoal } from '../goal-plan.js';
import { saveGoal, deleteGoal, createGoalHistory, deleteGoalHistory } from '../repository.js';
import { render } from '../render.js';

const FIELDS = ['g-wt', 'g-start', 'g-pace'];

function readForm() {
  return {
    weight: parseFloat(byId('g-wt').value),
    start: byId('g-start').value,
    pace: parseFloat(byId('g-pace').value),
  };
}

/** Empties the form and hides everything that describes the (now gone) active goal. */
export function resetGoalForm() {
  FIELDS.forEach((id) => { byId(id).value = ''; });
  setVisible(byId('goal-preview'), false);
  setVisible(byId('goal-summary'), false);
}

// ── Preview ───────────────────────────────────────────────────────────────────
function updatePreview() {
  const { weight, start, pace } = readForm();
  const preview = byId('goal-preview');
  if (!weight || !start || !pace || pace <= 0) {
    setVisible(preview, false);
    return;
  }
  const plan = planGoal(weight, start, pace, state.entries);
  setVisible(preview, true);
  preview.innerHTML =
    `<b>${plan.isBulk ? 'Bulking' : 'Cutting'}</b>` +
    (plan.current !== null ? ` from <b>${plan.startWeight.toFixed(1)} kg</b>` : '') +
    ` to <b>${weight} kg</b><br>` +
    `At <b>${plan.isBulk ? '+' : '-'}${pace} kg/wk</b> → <b>${plan.weeks.toFixed(1)} weeks</b> (~${plan.days} days)<br>` +
    `Estimated end: <b>${formatDate(plan.endDate)}</b>`;
}

// ── Save / remove ─────────────────────────────────────────────────────────────
function inputError({ weight, start, pace }) {
  if (!weight || weight < 30 || weight > 250) return 'Enter a valid target weight (30–250 kg).';
  if (!start) return 'Please set a start date.';
  if (!pace || pace <= 0 || pace > 2) return 'Enter a valid pace (0.05–2 kg/week).';
  return '';
}

function planError(plan) {
  if (plan.current !== null && Math.abs(plan.delta) < 0.1) return 'Target weight must differ from current weight.';
  if (plan.endDate <= today()) return 'Calculated end date is in the past. Adjust pace or start date.';
  return '';
}

async function onSave() {
  const input = readForm(), err = byId('goal-err'), btn = byId('btn-save-goal');
  // The inputs are checked before planning: an empty date or zero pace can't be planned at all.
  const invalidInput = inputError(input);
  if (invalidInput) { err.textContent = invalidInput; return; }
  const plan = planGoal(input.weight, input.start, input.pace, state.entries);
  const invalidPlan = planError(plan);
  if (invalidPlan) { err.textContent = invalidPlan; return; }
  // Replacing a running goal archives it, so that takes a second tap.
  if (state.goal && !confirmTap(btn, 'Tap again to confirm')) return;
  if (state.goal) {
    const archived = archiveGoal(state.goal, { keepStartWeight: true });
    state.goalHistory.unshift(archived);
    await createGoalHistory(archived);
  }
  err.textContent = '';
  state.goal = {
    weight: input.weight, start: input.start, date: plan.endDate, pace: input.pace,
    isBulk: plan.isBulk, startWeight: plan.startWeight,
  };
  setVisible(byId('btn-clear-goal'), true);
  render();
  await saveGoal(state.goal);
}

async function onClear() {
  const btn = byId('btn-clear-goal');
  if (!confirmTap(btn, 'Tap again to confirm removal')) return;
  state.goal = null;
  resetGoalForm();
  setVisible(btn, false);
  render();
  await deleteGoal();
}

// ── Summary of the active goal ────────────────────────────────────────────────
export function renderGoalSummary() {
  const goal = state.goal;
  if (!goal) return;
  setVisible(byId('goal-summary'), true);
  const cur = latestWeight();
  const remainingWeeks = Math.max(0.01, (new Date(goal.date) - new Date()) / WEEK_MS);
  const needed = cur ? ((goal.weight - cur) / remainingWeeks).toFixed(2) : '-';
  const sign = parseFloat(needed) > 0 ? '+' : '';
  const totalWeeks = Math.round((new Date(goal.date) - new Date(goal.start)) / WEEK_MS);
  byId('goal-summary-text').innerHTML =
    `<b>${goal.weight} kg</b> by <b>${formatDate(goal.date)}</b><br>` +
    `<span class="goal-summary-meta">Started ${formatDate(goal.start)} · ${totalWeeks} weeks · ` +
    `target pace: <b>${goal.isBulk ? '+' : '-'}${goal.pace} kg/wk</b>` +
    (cur ? `<br>Currently need: <b>${sign}${needed} kg/wk</b>` : '') + '</span>';
}

// ── Past goals ────────────────────────────────────────────────────────────────
function pastGoalHtml(g, index) {
  const isBulk = g.isBulk !== undefined ? g.isBulk : false;
  const startWeight = goalStartWeight(g, state.entries);
  const weights = startWeight !== null
    ? startWeight.toFixed(1) + ' → ' + g.weight.toFixed(1) + ' kg'
    : g.weight.toFixed(1) + ' kg';
  return `<div class="past-goal" data-index="${index}">` +
    `<div><span class="pg-kind ${isBulk ? 'bulk' : 'cut'}">${isBulk ? 'Bulk' : 'Cut'}</span>` +
    `<span class="pg-dates">${formatDate(g.start)} → ${formatDate(g.date)}</span></div>` +
    `<div class="pg-right"><span class="pg-weights">${weights}</span>` +
    '<button class="ebtn" data-action="delete">Delete</button></div></div>';
}

// The goals as last drawn. Rows point into this snapshot rather than into state.goalHistory,
// which can gain entries (a goal archived from the Overview) before the list is redrawn.
let shownGoals = [];

function renderPastGoals() {
  const card = byId('goal-history-card'), list = byId('goal-history-list');
  setVisible(card, state.goalHistory.length > 0);
  if (!state.goalHistory.length) return;
  shownGoals = state.goalHistory.slice();
  list.innerHTML = shownGoals.map(pastGoalHtml).join('');
}

async function onPastGoalClick(e) {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;
  const g = shownGoals[Number(btn.closest('.past-goal').dataset.index)];
  if (!g || !confirmTap(btn)) return;
  state.goalHistory = state.goalHistory.filter((x) => x._id !== g._id);
  await deleteGoalHistory(g);
  renderGoalTab();
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export function renderGoalTab() {
  const goal = state.goal;
  setVisible(byId('btn-clear-goal'), !!goal);
  if (goal) {
    byId('g-wt').value = goal.weight;
    byId('g-start').value = goal.start || '';
    byId('g-pace').value = goal.pace || '';
    updatePreview();
    renderGoalSummary();
  } else {
    setVisible(byId('goal-summary'), false);
    setVisible(byId('goal-preview'), false);
  }
  renderPastGoals();
}

export function initGoalTab() {
  FIELDS.forEach((id) => byId(id).addEventListener('input', updatePreview));
  byId('btn-save-goal').addEventListener('click', onSave);
  byId('btn-clear-goal').addEventListener('click', onClear);
  byId('goal-history-list').addEventListener('click', onPastGoalClick);
}
