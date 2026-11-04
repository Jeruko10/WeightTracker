// Public API of the Bodyweight section. Nothing outside this folder imports anything else.
import { showSync, flashSync } from '../../shared/sync-status.js';
import { state, resetState } from './state.js';
import { fetchAll } from './repository.js';
import { render } from './render.js';
import { buildDailySeries, windowAvg } from './stats.js';
import { initTabs } from './views/tabs.js';
import { initHistory } from './views/history.js';
import { initGoalTab } from './views/goal-tab.js';
import { initGoalBanner } from './views/goal-banner.js';
import { initRangeSelect } from './chart/weight-chart.js';
import { view as chartView, destroyChart } from './chart/chart-view.js';

export { exportBodyweight, bodyweightReport } from './export.js';

/**
 * Builds a `date → 7-day average bodyweight (kg)` lookup from the logged weigh-ins (null when
 * there are none). Dates before the first weigh-in use the first available average — callers
 * can tell via `lookup.firstDate` that the value is an estimate. The series is built once, so
 * the lookup is cheap to call for many dates.
 */
export function makeBodyweightLookup() {
  const entries = state.entries;
  if (!entries.length) {
    const none = () => null;
    none.firstDate = null;
    return none;
  }
  const first = entries[0].date, last = entries[entries.length - 1].date;
  const series = buildDailySeries(entries);
  const lookup = (date) => windowAvg(series, date < first ? first : date > last ? last : date, 7, first);
  lookup.firstDate = first;
  return lookup;
}

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

/** Redraws the section (charts read their colours when drawn, so a theme change needs it). */
export function refreshBodyweight() {
  render();
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
