// Trend maths over the logged weigh-ins. Pure: no DOM, no Firebase.
import { addDays, daysBetween } from '../../lib/dates.js';

// Two conditions gate the trend stats: enough calendar coverage for two 7-day windows,
// AND enough real logs that those windows aren't mostly guessed via interpolation.
export const MIN_ENTRIES = 6;
export const MIN_SPAN_DAYS = 13;

// Fills gaps between logged entries with a straight-line estimate per day, so a single
// entry after a multi-day gap doesn't get treated as one sudden jump in the averages below.
export function buildDailySeries(entries) {
  const series = {}, n = entries.length;
  if (!n) return series;
  if (n === 1) {
    series[entries[0].date] = entries[0].weight;
    return series;
  }
  for (let i = 0; i < n - 1; i++) {
    const d1 = entries[i].date, w1 = entries[i].weight;
    const w2 = entries[i + 1].weight;
    const days = daysBetween(d1, entries[i + 1].date);
    for (let k = 0; k <= days; k++) {
      series[addDays(d1, k)] = days > 0 ? w1 + (w2 - w1) * (k / days) : w1;
    }
  }
  return series;
}

/** Mean of the `spanDays` days ending on `endDate`, never reaching before `rangeStart`. */
export function windowAvg(series, endDate, spanDays, rangeStart) {
  const vals = [];
  for (let k = 0; k < spanDays; k++) {
    const day = addDays(endDate, -k);
    if (day < rangeStart) break;
    if (series[day] !== undefined) vals.push(series[day]);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// Walks day-by-day through the interpolated series to find when the 7-day average first
// crossed the goal weight, so the congratulations message can report a real date, not "today".
export function findReachedDate(series, targetWeight, goalIsGain, rangeStart, rangeEnd) {
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    const avg = windowAvg(series, d, 7, rangeStart);
    if (avg !== null && (goalIsGain ? avg >= targetWeight : avg <= targetWeight)) return d;
  }
  return rangeEnd;
}

/**
 * Everything the Overview and the export derive from the entries: the current 7-day average
 * (calendar days ending on the last log, gaps interpolated) and, once there is enough data,
 * the 7 days before it.
 */
export function computeTrend(entries) {
  const n = entries.length;
  const firstDate = n ? entries[0].date : null;
  const lastDate = n ? entries[n - 1].date : null;
  const series = buildDailySeries(entries);
  const curAvg = n ? windowAvg(series, lastDate, 7, firstDate) : null;
  const spanDays = n ? daysBetween(firstDate, lastDate) : 0;
  const enoughData = n >= MIN_ENTRIES && spanDays >= MIN_SPAN_DAYS;
  const prevAvg = enoughData ? windowAvg(series, addDays(lastDate, -7), 7, firstDate) : null;
  return {
    n, firstDate, lastDate, series, curAvg, prevAvg, spanDays, enoughData,
    current: n ? entries[n - 1].weight : null,
  };
}
