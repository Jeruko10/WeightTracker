// The header cycle label and the three average tiles at the top of the Overview.
import { byId, setVisible } from '../../../lib/dom.js';
import { state } from '../state.js';
import { hasTimeline } from '../goal-plan.js';

// The cycle label row is hidden entirely without a goal, so it leaves no empty gap.
export function renderCycleLabel() {
  const label = byId('cycle-label'), row = byId('header-titles');
  const goal = state.goal;
  setVisible(label, hasTimeline(goal));
  setVisible(row, hasTimeline(goal));
  if (!hasTimeline(goal)) return;
  const isBulk = goal.isBulk !== undefined ? goal.isBulk : true;
  label.textContent = isBulk ? 'BULKING CYCLE' : 'CUTTING CYCLE';
  label.classList.toggle('bulk', isBulk);
  label.classList.toggle('cut', !isBulk);
}

export function renderStats(trend) {
  const cur = byId('s-cur'), prev = byId('s-avg'), rate = byId('s-rate');
  cur.textContent = trend.n ? trend.curAvg.toFixed(1) + ' kg' : '-';
  rate.classList.remove('up', 'down');
  if (!trend.n || trend.prevAvg === null) {
    prev.textContent = '-';
    rate.textContent = '-';
    return;
  }
  const diff = trend.curAvg - trend.prevAvg;
  prev.textContent = trend.prevAvg.toFixed(1) + ' kg';
  rate.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' kg';
  if (diff > 0) rate.classList.add('up');
  else if (diff < 0) rate.classList.add('down');
}
