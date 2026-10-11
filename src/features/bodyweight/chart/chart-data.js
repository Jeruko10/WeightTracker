// Builds what the weight chart draws: the day axis, the x window for the selected range, and the
// datasets (weight line + one ideal-pace segment per goal cycle). Pure apart from reading state.
import { WEEK_MS, today, daysBetween } from '../../../lib/dates.js';
import { COLORS } from '../../../shared/theme.js';
import { state } from '../state.js';
import { goalStartWeight } from '../goal-plan.js';

const RANGE_DAYS = { '1w': 7, '2w': 14, '1m': 30, '1y': 365 };

// Horizontal scroll past the range's day threshold, at a fixed px/day so points never get more
// cramped as data grows. "1y" is exempt — always compacts to fit, as a zoomed-out overview.
// "All time" gets a larger threshold (100) since it's meant to stay browsable longer before
// handing off to scroll. Below the threshold, points hide past 60 days so a dense compacted
// line doesn't turn into a blob — except "all", which always hides them.
const SCROLL_THRESHOLD = 30, ALL_TIME_THRESHOLD = 100, DENSE_DAYS = 60;
export const PX_PER_DAY = 24;
const POINT_R = 2.8;
// Hover reach depends on whether the points are drawn. With points visible, detection is
// bounded to a radius around each one (they're small, so the hit area is padded well past
// the dot). With points hidden there is nothing to aim at, so it falls back to "closest
// point on the x axis", which has no distance limit by design.
const HIT_R = 9;

/** Every calendar day from the first entry to today (or the last entry, if later). */
export function buildDayAxis(entries) {
  const dates = [], n = entries.length;
  if (!n) return dates;
  const lastDay = today() > entries[n - 1].date ? today() : entries[n - 1].date;
  const cursor = new Date(entries[0].date), end = new Date(lastDay);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** The x window for the selected range, clamped to the data we actually have. */
export function rangeWindow(range, dates, goal) {
  const lastIdx = dates.length - 1;
  if (!dates.length) return { start: 0, end: 0 };
  const dayIdx = (d) => daysBetween(dates[0], d);
  const todayIdx = Math.min(lastIdx, dayIdx(today()));
  let start, end;
  if (RANGE_DAYS[range]) {
    end = todayIdx;
    start = end - (RANGE_DAYS[range] - 1);
  } else if (range === 'goal' && goal && goal.start) {
    end = todayIdx;
    start = dayIdx(goal.start);
  } else {
    start = 0;
    end = lastIdx;
  }
  if (start < 0) start = 0;
  if (end > lastIdx) end = lastIdx;
  if (end < start) end = start;
  return { start, end };
}

/** How the selected range is drawn: scrolling or fitted, and whether points are shown. */
export function rangeLayout(range, visibleDays) {
  const threshold = range === 'all' ? ALL_TIME_THRESHOLD : SCROLL_THRESHOLD;
  const scrollable = range !== '1y' && visibleDays > threshold;
  const pointRadius = scrollable ? POINT_R : range === 'all' ? 0 : visibleDays > DENSE_DAYS ? 0 : POINT_R;
  return {
    scrollable,
    pointRadius,
    pointsVisible: pointRadius > 0,
    tickLimit: scrollable ? Math.min(visibleDays, 60) : 8,
  };
}

/**
 * Hover behaviour. With points drawn, a reading is bounded by each point's hit radius. With
 * nothing drawn to aim at, it is not required to land on a point — but it is still measured in
 * both axes. Picking purely by horizontal distance would tie between the weight line and the
 * pace line, which both carry a point at nearly every date, and the winner would be arbitrary;
 * with both axes it is whichever line the cursor is nearer to.
 */
export function interactionFor(pointsVisible) {
  return { mode: 'nearest', axis: 'xy', intersect: pointsVisible };
}

// tension:0 (straight segments between logged days) rather than a spline. A spline's control
// points are derived from the points currently in the x window, so the curve between two
// entries changed shape depending on the selected range. It also invented movement on days
// with no entry — bulging above or below the two weights it sits between. Straight segments
// are window-independent and match the linear interpolation the stats already assume.
//
// Only the days that were actually logged become points. Padding the series with one element
// per calendar day and letting spanGaps skip the empty ones drew exactly the same line, but it
// left hundreds of null elements in the dataset. As the x window slides over them during a
// zoom, Chart.js pulls them into the range it paints and they can land at the base of the chart
// for a frame, which is the line dropping to the bottom-left and snapping back.
function weightDataset(entries, dates, layout) {
  return {
    label: 'Weight',
    data: entries.map((e) => ({ x: daysBetween(dates[0], e.date), y: e.weight })),
    borderColor: COLORS.accent, backgroundColor: COLORS.accentFill,
    borderWidth: 2, pointRadius: layout.pointRadius, pointHoverRadius: 5,
    pointHitRadius: layout.pointsVisible ? HIT_R : 0,
    pointBackgroundColor: COLORS.accent, tension: 0, fill: true,
  };
}

// One dashed segment per goal cycle — the active one and every archived one — so the older
// stretches of the weight line can be read against the plan they were actually run against.
//
// A point per day rather than just the two ends. The line is straight either way, but a
// two-point line can only be hovered at its endpoints. One point per day makes the whole segment
// queryable and each reading lands on the exact date. Cycles do not overlap, so all segments
// together hold about one point per day of history in total.
function idealSegment(goal, endDate, entries, dates) {
  if (!entries.length || !goal || !goal.start || !goal.date) return null;
  const lastIdx = dates.length - 1;
  const start = new Date(goal.start);
  const totalWeeks = Math.max(0.01, (new Date(goal.date) - start) / WEEK_MS);
  const startWeight = goalStartWeight(goal, entries) ?? entries[0].weight;
  const clampIdx = (d) => Math.max(0, Math.min(lastIdx, daysBetween(dates[0], d)));
  const i0 = clampIdx(goal.start), i1 = clampIdx(endDate);
  if (i1 <= i0) return null;
  const pts = [];
  for (let i = i0; i <= i1; i++) {
    const t = (new Date(dates[i]) - start) / WEEK_MS;
    pts.push({ x: i, y: parseFloat((startWeight + (goal.weight - startWeight) * (t / totalWeeks)).toFixed(2)) });
  }
  return pts;
}

// A smaller hit radius than the weight line's, so a reading near a logged weight still resolves
// to the weight rather than to the plan drawn beside it.
function idealDataset(data) {
  return {
    label: 'Ideal pace', data, borderColor: COLORS.amber, borderWidth: 1.5, borderDash: [6, 3],
    pointRadius: 0, pointHoverRadius: 4, pointHitRadius: Math.round(HIT_R * 0.6), tension: 0, fill: false,
  };
}

export function buildDatasets(dates, layout) {
  const { entries, goal, goalHistory } = state;
  const datasets = [weightDataset(entries, dates, layout)];
  if (goal) {
    const current = idealSegment(goal, dates[dates.length - 1], entries, dates); // runs up to today
    if (current) datasets.push(idealDataset(current));
  }
  goalHistory.forEach((g) => {
    // An archived cycle's plan only means anything while that cycle was in force: up to its own
    // end date, or to the day it was replaced if that came first. Past either point the formula
    // would carry on extrapolating beyond the weight it was aiming at.
    const end = g.savedOn && g.savedOn < g.date ? g.savedOn : g.date;
    const seg = idealSegment(g, end, entries, dates);
    if (seg) datasets.push(idealDataset(seg));
  });
  return datasets;
}
