// The animated zoom between two chart ranges.
//
// It runs in three phases so that every change to the tick set happens while the labels are at
// zero opacity. Switching tick modes (auto ↔ pinned count) or bounds while they are visible is
// what makes labels appear from nowhere and reshuffle:
//   1. fade out  — nothing moves; the old frame and its own tick set just dim away
//   2. zoom      — labels hidden, tick count pinned so the grid glides with the bounds
//   3. fade in   — bounds already final and ticks back on automatic, so the labels appear
//                  directly in their end positions and never re-lay-out afterwards
import {
  view, yBounds, setAxisChrome, applyWindow, applyFinalLayout,
  visibleWindow, targetVisibleWindow, cancelAnimation,
} from './chart-view.js';
import { planZoomY, zoomYBounds } from './zoom-planner.js';

// 1000ms in total. The fades finish slightly inside their phases (OUT*0.75, and HOLD ms before
// the fade-in) so that opacity is already a hard 0 for at least one frame either side of a
// tick-mode switch — otherwise the last frame before a switch still carries a few percent of
// opacity and can flash the old tick set.
const OUT = 195, ZOOM = 485, HOLD = 30, IN = 290;

// easeInOutCubic: easeOut alone starts so fast that the first frames jump a large slice of the
// zoom at once, which shows up as the vertical scale lurching. Easing in as well spreads it out.
function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function animateChartWindow(toMin, toMax, tickLimit, prevWin) {
  const chart = view.chart;
  // Read what is on screen BEFORE anything touches the layout.
  const fromV = visibleWindow(prevWin), toV = targetVisibleWindow(toMin, toMax);
  view.win = { min: toMin, max: toMax };
  cancelAnimation();
  // Start from the scale actually on screen, not a recomputed one — a scrolling range settles
  // with the vertical scale of its WHOLE window, which is wider than the visible slice's own
  // bounds, and recomputing here would make the line jump the moment the zoom begins.
  const ySc = chart.options.scales.y;
  const yFrom = typeof ySc.min === 'number' && typeof ySc.max === 'number'
    ? { min: ySc.min, max: ySc.max }
    : prevWin ? yBounds(prevWin.min, prevWin.max) : null;
  const yTo = yBounds(toMin, toMax);
  if (!fromV || (fromV.min === toV.min && fromV.max === toV.max)) {
    chart.options.scales.x.ticks.maxTicksLimit = tickLimit;
    setAxisChrome(1, false);
    applyFinalLayout(toMin, toMax, yTo);
    return;
  }
  const yPlan = planZoomY(fromV, toV, yFrom, yTo, yBounds);
  const t0 = performance.now();
  let settled = false;

  function step(now) {
    const t = now - t0;
    let done = false;
    if (t < OUT) {
      // Fit the canvas to the container up front. Coming from a scrolling range this is
      // invisible: the same days stay under the cursor at the same px-per-day.
      setAxisChrome(Math.max(0, 1 - t / (OUT * 0.75)), false);
      applyWindow(fromV.min, fromV.max, yFrom, '100%');
    } else if (t < OUT + ZOOM) {
      const e = easeInOutCubic((t - OUT) / ZOOM);
      const cMin = fromV.min + (toV.min - fromV.min) * e, cMax = fromV.max + (toV.max - fromV.max) * e;
      setAxisChrome(0, true);
      applyWindow(cMin, cMax, zoomYBounds(cMin, cMax, e, yFrom, yTo, yPlan, yBounds), '100%');
    } else {
      // The new tick limit and the scrolling canvas both land here, with the labels still
      // invisible, so the fade-in is the first time the final layout is ever drawn.
      if (!settled) {
        settled = true;
        chart.options.scales.x.ticks.maxTicksLimit = tickLimit;
        applyFinalLayout(toMin, toMax, yTo);
      }
      const q = Math.max(0, Math.min(1, (t - OUT - ZOOM - HOLD) / IN));
      setAxisChrome(q, false);
      applyWindow(toMin, toMax, yTo, null);
      done = q >= 1;
    }
    view.animFrame = done ? null : requestAnimationFrame(step);
  }
  step(t0);
}
