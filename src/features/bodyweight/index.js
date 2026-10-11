// Public API of the Bodyweight section. Nothing outside this folder imports anything else.
import { showSync, flashSync } from '../../shared/sync-status.js';
import { state, resetState } from './state.js';
import { fetchAll } from './repository.js';
import { render } from './render.js';
import { initTabs } from './views/tabs.js';
import { initHistory } from './views/history.js';
import { initGoalTab } from './views/goal-tab.js';
import { initGoalBanner } from './views/goal-banner.js';
import { initRangeSelect } from './chart/weight-chart.js';
import { view as chartView, destroyChart } from './chart/chart-view.js';

export { exportBodyweight } from './export.js';

export function initBodyweight() {
  initTabs();
  initHistory();
  initGoalTab();
  initGoalBanner();
  initRangeSelect(render);
}

export async function loadBodyweight() {
  showSync('Loading…');
  try {
    Object.assign(state, await fetchAll());
    flashSync('Synced', 'saved');
    render();
  } catch (e) {
    showSync('Error loading data', 'error');
    console.error(e);
  }
}

export function clearBodyweight() {
  resetState();
  destroyChart();
}

// The chart may have been laid out while its section was hidden (zero width), which also
// leaves a scrolling range parked at the wrong offset. A plain re-render re-applies the layout.
export function onBodyweightShown() {
  if (chartView.chart) render();
}
