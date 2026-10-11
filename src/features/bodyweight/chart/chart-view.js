// State and layout of the weight chart.
//
// The chart always holds the FULL day-by-day series; the range dropdown only moves the x-axis
// bounds over it. Switching range therefore animates as a true zoom — the same line stretches
// or compresses — instead of swapping in a different dataset that has to pop in.
import { byId } from '../../../lib/dom.js';
import { CHART_THEME } from '../../../shared/theme.js';

export const view = {
  /** The Chart.js instance, or null before the first render / after sign-out */
  chart: null,
  /** Selected range: '1w' | '2w' | '1m' | '1y' | 'all' | 'goal' */
  range: '2w',
  /** Set when the range dropdown changes, so the next render animates instead of jumping */
  transitionQueued: false,
  /** Calendar day for each x index */
  dates: [],
  pxPerDay: 24,
  /** Whether the current range is drawn wider than the card and scrolls horizontally */
  scrollable: false,
  /** The x window ({min,max} day indexes) the chart is showing or zooming towards */
  win: null,
  /** requestAnimationFrame id of a running zoom */
  animFrame: null,
};

// Fixed axis sizes — see the afterFit hooks on the scales. Wide/tall enough for the longest
// label either axis can produce ("100.0" for a three-digit weight, "17/08" unrotated).
// X_PAD is the side room the x axis keeps so an end date label is never clipped: half a
// label's width. Chart.js would otherwise size this from wherever the outermost tick happens to
// land, which autoSkip places differently in each range — that is what moved the right edge.
export const AXIS = { yWidth: 48, xHeight: 30, xPad: 20, tickPad: 8 };

export function cancelAnimation() {
  if (view.animFrame) {
    cancelAnimationFrame(view.animFrame);
    view.animFrame = null;
  }
}

export function destroyChart() {
  cancelAnimation();
  if (view.chart) {
    view.chart.destroy();
    view.chart = null;
  }
}

// Exact min/max of the DRAWN line across a window whose edges may sit between logged days.
// The fractional edges are the point: during a zoom the window grows continuously, so if the
// bounds only ever consider whole logged days they jump the instant a day crosses the edge —
// and the whole chart lurches vertically. Taking the line's interpolated value AT each edge
// makes the bounds a continuous function of the window, so the vertical scale glides instead.
// It is also tighter than reaching out to the neighbouring logged day, which with a long gap
// could be at a very different weight and would inflate the range for no visible reason.
export function yBounds(minX, maxX) {
  if (!view.chart) return null;
  let mn = Infinity, mx = -Infinity;
  const include = (v) => {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  };
  view.chart.data.datasets.forEach((ds) => {
    const d = ds.data, n = d.length;
    if (!n) return;
    // Where the drawn line crosses x — null when the line does not reach that far.
    const valueAt = (x) => {
      if (x <= d[0].x || x >= d[n - 1].x) return null;
      for (let i = 1; i < n; i++) {
        if (d[i].x >= x) {
          const a = d[i - 1], b = d[i];
          return b.x === a.x ? b.y : a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
        }
      }
      return null;
    };
    [valueAt(minX), valueAt(maxX)].forEach((v) => { if (v !== null) include(v); });
    d.forEach((p) => { if (p.x >= minX && p.x <= maxX) include(p.y); });
  });
  if (mn === Infinity) return null;
  const pad = Math.max(0.3, (mx - mn) * 0.15);
  return { min: mn - pad, max: mx + pad };
}

// Closes the right-hand edge of the plot box. The other three sides come for free — the two
// scale borders draw the left and bottom, and the top is the last horizontal gridline — but the
// right edge would need a vertical gridline exactly at the window's end, and there is only one
// when a date tick happens to land there. Ranges where it does not (1 month, 1 year, All time)
// were left with the box open on that side. Uses the grid's current colour so it fades out with
// the rest of the grid during a zoom.
export const chartBoxPlugin = {
  id: 'chartBox',
  afterDraw(c) {
    const a = c.chartArea;
    if (!a) return;
    const ctx = c.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = c.options.scales.x.grid.color;
    ctx.lineWidth = 1;
    ctx.moveTo(a.right - 0.5, a.top);
    ctx.lineTo(a.right - 0.5, a.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

// Axis labels and gridlines during a zoom. Two separate problems are handled here:
//   • Chart.js regenerates ticks at "nice" round values every frame, so as the bounds move the
//     gridlines snap between step sizes instead of gliding. Pinning a fixed tick count while
//     animating makes them evenly spaced fractions of the window, which slide continuously.
//   • Which labels fit also changes frame to frame, so text pops in and out. Rather than fight
//     that, the labels and grid fade out at the start and back in once the zoom has settled.
export function setAxisChrome(alpha, animating) {
  if (!view.chart) return;
  const { x, y } = view.chart.options.scales;
  const tickColor = 'rgba(' + CHART_THEME.tickRgb + ',' + alpha + ')';
  const gridColor = 'rgba(255,255,255,' + (CHART_THEME.gridAlpha * alpha).toFixed(4) + ')';
  x.ticks.color = tickColor; y.ticks.color = tickColor;
  x.grid.color = gridColor; y.grid.color = gridColor;
  x.grid.tickColor = gridColor; y.grid.tickColor = gridColor;
  x.ticks.count = animating ? 7 : undefined;
  x.ticks.autoSkip = !animating;
  // y keeps its fixed count at rest too — evenly spaced ticks are what put a gridline exactly on
  // the top and bottom edges of the box. Handing it back to automatic would reopen that gap, and
  // it also means the y grid does not change at all when the animation ends.
}

/**
 * Paints one frame: x bounds, matching y bounds, and optionally the canvas width.
 * `yb` undefined → computed from the window; `widthCss` null → leave the current width alone.
 */
export function applyWindow(minX, maxX, yb, widthCss) {
  const chart = view.chart;
  if (!chart) return;
  chart.options.scales.x.min = minX;
  chart.options.scales.x.max = maxX;
  if (yb === undefined) yb = yBounds(minX, maxX);
  if (yb) {
    chart.options.scales.y.min = yb.min;
    chart.options.scales.y.max = yb.max;
  }
  if (widthCss) {
    const inner = byId('chart-inner');
    if (inner.style.width !== widthCss) {
      inner.style.width = widthCss;
      chart.resize();
    }
  }
  chart.update('none');
}

// Which days are on screen right now. For a scrolling range the canvas is far wider than its
// container, so only a slice is visible; the zoom has to animate THAT slice. Animating the whole
// window instead means growing the canvas underneath a fixed-size viewport, and the line tears
// across the visible strip while the rest of it is drawn off-screen.
export function visibleWindow(fullWin) {
  if (!fullWin) return null;
  const wrap = byId('chart-wrap'), inner = byId('chart-inner');
  const wrapW = wrap.clientWidth, innerW = inner.offsetWidth || wrapW;
  if (innerW <= wrapW + 1) return { min: fullWin.min, max: fullWin.max };
  const perDay = innerW / (fullWin.max - fullWin.min + 1);
  const start = fullWin.min + wrap.scrollLeft / perDay;
  return { min: start, max: start + wrapW / perDay };
}

// Where the zoom should land visually: the whole window when it fits, otherwise the most recent
// days at the scroll density — a scrolling range settles showing today, not the oldest entries.
export function targetVisibleWindow(winStart, winEnd) {
  if (!view.scrollable) return { min: winStart, max: winEnd };
  const viewDays = byId('chart-wrap').clientWidth / view.pxPerDay;
  return { min: Math.max(winStart, winEnd - viewDays + 1), max: winEnd };
}

// The settled state: the full window on a canvas sized for the range, scrolled to today. Taking
// over from the animation is invisible because its last frame already shows exactly these days
// at exactly this px-per-day.
export function applyFinalLayout(winStart, winEnd, yb) {
  const wrap = byId('chart-wrap');
  const width = view.scrollable ? Math.round((winEnd - winStart + 1) * view.pxPerDay) + 'px' : '100%';
  applyWindow(winStart, winEnd, yb, width);
  if (view.scrollable) wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
}
