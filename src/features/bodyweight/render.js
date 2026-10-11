// Redraws the whole Bodyweight section from state. Called after every change.
import { state } from './state.js';
import { computeTrend } from './stats.js';
import { renderCycleLabel, renderStats } from './views/overview-stats.js';
import { renderGoalBanner } from './views/goal-banner.js';
import { renderGoalSummary } from './views/goal-tab.js';
import { renderWeeklySummary } from './views/weekly-summary.js';
import { renderHistory } from './views/history.js';
import { renderWeightChart } from './chart/weight-chart.js';

export function render() {
  const trend = computeTrend(state.entries);
  renderCycleLabel();
  renderStats(trend);
  renderGoalBanner(trend);
  renderGoalSummary();
  renderWeightChart();
  renderWeeklySummary();
  renderHistory();
}
