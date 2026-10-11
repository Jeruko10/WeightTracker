// "Weekly summary" card: average weight per ISO-ish week, newest first.
import { byId } from '../../../lib/dom.js';
import { weekKey } from '../../../lib/dates.js';
import { plural } from '../../../lib/html.js';
import { state } from '../state.js';

const WEEKS_SHOWN = 8;

export function renderWeeklySummary() {
  const box = byId('week-summary');
  if (!state.entries.length) {
    box.innerHTML = '<p class="empty">No entries yet</p>';
    return;
  }
  const weeks = {};
  state.entries.forEach((e) => {
    const k = weekKey(e.date);
    (weeks[k] = weeks[k] || []).push(e.weight);
  });
  const rows = Object.entries(weeks)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, WEEKS_SHOWN)
    .map(([key, weights]) => {
      const avg = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);
      const [year, week] = key.split('-W');
      return `<tr><td>Week ${week}, ${year}</td><td>${avg} kg</td>` +
        `<td>${weights.length} ${plural(weights.length, 'entry', 'entries')}</td></tr>`;
    })
    .join('');
  box.innerHTML = '<table class="wtbl"><thead><tr><th>Week</th><th>Avg</th><th></th></tr></thead>' +
    `<tbody>${rows}</tbody></table>`;
}
