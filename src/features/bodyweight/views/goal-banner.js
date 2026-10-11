// The goal banner on the Overview: pace chip, projection and progress bars while a goal is
// running, or a "reached" / "missed" message with its action once it has ended.
import { byId, setVisible } from '../../../lib/dom.js';
import { DAY_MS, WEEK_MS, today, addDays, formatDate, formatLocalDate } from '../../../lib/dates.js';
import { plural } from '../../../lib/html.js';
import { state } from '../state.js';
import { MIN_ENTRIES, MIN_SPAN_DAYS, findReachedDate } from '../stats.js';
import { goalStartWeight, hasTimeline, archiveGoal } from '../goal-plan.js';
import { saveGoal, deleteGoal, createGoalHistory } from '../repository.js';
import { resetGoalForm } from './goal-tab.js';
import { render } from '../render.js';

function els() {
  return {
    chip: byId('pace-chip'), desc: byId('pace-desc'), bars: byId('bars'), proj: byId('proj-line'),
    title: byId('banner-title'), reached: byId('goal-reached-box'), missed: byId('goal-missed-box'),
  };
}

function setChip(el, cls, text) {
  el.className = 'chip ' + cls;
  el.textContent = text;
}

export function renderGoalBanner(trend) {
  const ui = els(), goal = state.goal;
  setVisible(ui.reached, false);
  setVisible(ui.missed, false);
  state.pendingReset = null;

  if (!hasTimeline(goal) || !trend.current) {
    setChip(ui.chip, 'none', hasTimeline(goal) ? 'Not enough data' : 'No goal set');
    ui.desc.textContent = '';
    setVisible(ui.bars, false);
    setVisible(ui.proj, false);
    ui.title.textContent = 'Goal';
    return;
  }

  const startWeight = goalStartWeight(goal, state.entries) ?? state.entries[0].weight;
  const ctx = {
    ui, goal, trend, startWeight,
    now: new Date(), start: new Date(goal.start), end: new Date(goal.date),
    isGain: goal.isBulk !== undefined ? goal.isBulk : goal.weight > startWeight,
  };
  ui.title.textContent = 'Goal · ' + goal.weight + ' kg by ' + formatDate(goal.date);

  // Reached: the 7-day average has crossed the target in the intended direction.
  const reached = ctx.isGain ? trend.curAvg >= goal.weight : trend.curAvg <= goal.weight;
  if (reached) renderReached(ctx);
  else if (ctx.now > ctx.end) renderPastDue(ctx);
  else renderInProgress(ctx);
}

function hideProgress(ui) {
  setVisible(ui.proj, false);
  setVisible(ui.bars, false);
  ui.desc.textContent = '';
}

function renderReached({ ui, goal, trend, start, end, isGain }) {
  hideProgress(ui);
  setChip(ui.chip, 'on', 'Goal reached!');
  setVisible(ui.reached, true);
  const rangeStart = goal.start > trend.firstDate ? goal.start : trend.firstDate;
  const reachedOn = new Date(findReachedDate(trend.series, goal.weight, isGain, rangeStart, trend.lastDate));
  const elapsedDays = Math.round((reachedOn - start) / DAY_MS);
  const diffDays = Math.round((reachedOn - end) / DAY_MS);
  const abs = Math.abs(diffDays);
  const timing = diffDays === 0 ? 'right on time'
    : diffDays < 0 ? abs + ' ' + plural(abs, 'day') + ' early'
    : diffDays + ' ' + plural(diffDays, 'day') + ' late';
  byId('goal-reached-text').innerHTML =
    `🎉 You reached your goal of <b>${goal.weight.toFixed(1)} kg</b> in <b>${(elapsedDays / 7).toFixed(1)} weeks</b>, ` +
    `<b>${timing}</b> compared to your original plan!`;
}

// The end date has passed without reaching the target: offer the same goal re-planned from
// today's average at the original pace.
function renderPastDue({ ui, goal, trend, isGain }) {
  hideProgress(ui);
  setChip(ui.chip, 'slow', 'Goal date passed');
  setVisible(ui.missed, true);
  const newStart = today();
  const weeks = Math.abs((goal.weight - trend.curAvg) / goal.pace) || 1;
  const newEnd = addDays(newStart, Math.round(weeks * 7));
  byId('goal-missed-text').innerHTML =
    `You should have reached <b>${goal.weight.toFixed(1)} kg</b> by now. No worries, that happens! ` +
    `Recalculating from your current average of <b>${trend.curAvg.toFixed(1)} kg</b> at your ` +
    `<b>${isGain ? '+' : '-'}${goal.pace} kg/wk</b> pace, ` +
    `you can still get there by <b>${formatDate(newEnd)}</b> if you stay focused.`;
  state.pendingReset = {
    weight: goal.weight, start: newStart, date: newEnd, pace: goal.pace,
    isBulk: goal.isBulk, startWeight: trend.curAvg,
  };
}

function renderInProgress(ctx) {
  const { goal, trend } = ctx;
  const remainingWeeks = Math.max(0.01, (ctx.end - ctx.now) / WEEK_MS);
  const neededPace = (goal.weight - trend.current) / remainingWeeks;
  const neededText = (neededPace >= 0 ? '+' : '') + neededPace.toFixed(2);
  // Actual pace — two consecutive 7-calendar-day windows (gaps interpolated), so a single log
  // after several quiet days reads as a gradual change, not a sudden one.
  const actualPace = trend.enoughData ? trend.curAvg - trend.prevAvg : null;

  renderPaceChip(ctx, actualPace, neededText);
  renderProjection(ctx, actualPace);
  renderProgressBars(ctx);
}

function renderPaceChip({ ui, goal, trend, isGain }, actualPace, neededText) {
  if (!trend.enoughData) {
    const missingDays = MIN_SPAN_DAYS - trend.spanDays, missingLogs = MIN_ENTRIES - trend.n;
    setChip(ui.chip, 'none', trend.spanDays < MIN_SPAN_DAYS
      ? 'Need ' + missingDays + ' more ' + plural(missingDays, 'day') + ' of data'
      : 'Need ' + missingLogs + ' more ' + plural(missingLogs, 'log'));
    ui.desc.textContent = '';
    return;
  }
  const desired = goal.pace, tolerance = desired * 0.5;
  const directed = isGain ? actualPace : -actualPace;
  if (directed > desired + tolerance) {
    setChip(ui.chip, 'fast', isGain ? 'Eat less' : 'Eat more');
    ui.desc.textContent = 'Slow down · need ' + neededText + ' kg/wk';
  } else if (directed < desired - tolerance) {
    setChip(ui.chip, 'slow', isGain ? 'Eat more' : 'Eat less');
    ui.desc.textContent = 'Push harder · need ' + neededText + ' kg/wk';
  } else {
    setChip(ui.chip, 'on', 'On track');
    ui.desc.textContent = neededText + ' kg/wk needed';
  }
}

// Projection — extrapolates the 7-day windowed pace to the target weight.
function renderProjection({ ui, goal, trend, end, isGain }, actualPace) {
  const proj = ui.proj;
  setVisible(proj, true);
  if (!trend.enoughData) {
    proj.textContent = 'Log more entries to see projection';
    return;
  }
  const movingRight = (isGain && actualPace > 0) || (!isGain && actualPace < 0);
  if (Math.abs(actualPace) < 0.001) {
    proj.textContent = 'Trend is flat. Log more data';
  } else if (!movingRight) {
    proj.textContent = 'Current trend is moving away from goal';
  } else {
    const weeksLeft = (goal.weight - trend.curAvg) / actualPace;
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + Math.round(weeksLeft * 7));
    const dd = Math.round((arrival - end) / DAY_MS);
    const timing = dd === 0 ? 'right on time' : dd < 0 ? Math.abs(dd) + 'd early' : dd + 'd late';
    proj.innerHTML = `At current rate, projected arrival: <b>${formatLocalDate(arrival)}</b> (<b>${timing}</b>)`;
  }
}

function renderProgressBars({ ui, goal, trend, startWeight, now, start, end }) {
  setVisible(ui.bars, true);
  const timePct = Math.min(100, Math.max(0, Math.round((now - start) / (end - start) * 100)));
  const daysLeft = Math.max(0, Math.round((end - now) / DAY_MS));
  byId('tl-s').textContent = formatDate(goal.start);
  byId('tl-e').textContent = formatDate(goal.date);
  byId('time-fill').style.width = timePct + '%';
  byId('time-sub').textContent = 'Time elapsed: ' + timePct + '% · ' + daysLeft + ' ' + plural(daysLeft, 'day') + ' left';
  // Tracks the current average (last 7 calendar days), not the last logged weight.
  const total = Math.abs(goal.weight - startWeight), done = Math.abs(trend.curAvg - startWeight);
  const weightPct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 100;
  byId('wl-s').textContent = startWeight.toFixed(1) + ' kg';
  byId('wl-e').textContent = goal.weight.toFixed(1) + ' kg';
  byId('wt-fill').style.width = weightPct + '%';
  byId('wt-sub').textContent = 'Weight progress: ' + weightPct + '% · ' +
    Math.abs(goal.weight - trend.curAvg).toFixed(1) + ' kg left';
}

// ── Actions ───────────────────────────────────────────────────────────────────
export function initGoalBanner() {
  byId('btn-goal-reached-ok').addEventListener('click', async () => {
    if (!state.goal) return;
    const archived = archiveGoal(state.goal);
    state.goalHistory.unshift(archived);
    await createGoalHistory(archived);
    state.goal = null;
    resetGoalForm();
    render();
    await deleteGoal();
  });
  byId('btn-goal-reset').addEventListener('click', async () => {
    const reset = state.pendingReset;
    if (!state.goal || !reset) return;
    const archived = archiveGoal(state.goal);
    state.goalHistory.unshift(archived);
    await createGoalHistory(archived);
    state.goal = {
      weight: reset.weight, start: reset.start, date: reset.date, pace: reset.pace,
      isBulk: reset.isBulk, startWeight: reset.startWeight,
    };
    state.pendingReset = null;
    render();
    await saveGoal(state.goal);
  });
}
