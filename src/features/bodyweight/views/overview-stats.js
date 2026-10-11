// The three average tiles at the top of the Overview.
import { byId } from '../../../lib/dom.js';

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
