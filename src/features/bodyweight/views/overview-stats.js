import { byId } from '../../../lib/dom.js';
import { MIN_ENTRIES, MIN_SPAN_DAYS } from '../stats.js';

export function renderStats(trend) {
  const cur = byId('s-cur'), prev = byId('s-avg'), rate = byId('s-rate');
  cur.textContent = trend.n ? trend.curAvg.toFixed(1) + ' kg' : '-';
  // Say why the comparison is empty instead of leaving dashes unexplained.
  byId('stats-note').textContent = trend.enoughData
    ? 'Averages cover 7 days; days without a weigh-in are interpolated.'
    : `Trends need ${MIN_ENTRIES}+ weigh-ins over ${MIN_SPAN_DAYS}+ days. You have ${trend.n} over ${trend.spanDays + (trend.n ? 1 : 0)} days.`;
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
