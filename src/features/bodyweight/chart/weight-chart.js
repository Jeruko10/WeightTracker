// The Overview's "Progress" chart: creates it once, then updates data and window in place.
import { byId } from '../../../lib/dom.js';
import { formatDate, formatDayMonth } from '../../../lib/dates.js';
import { CHART_THEME } from '../../../shared/theme.js';
import { state } from '../state.js';
import { view, AXIS, chartBoxPlugin, setAxisChrome, applyFinalLayout, cancelAnimation } from './chart-view.js';
import { animateChartWindow } from './zoom-animation.js';
import { PX_PER_DAY, buildDayAxis, rangeWindow, rangeLayout, interactionFor, buildDatasets } from './chart-data.js';

function createChart(datasets, interaction, tickLimit) {
  return new Chart(byId('chart'), {
    type: 'line',
    data: { datasets },
    plugins: [chartBoxPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Every frame of a range change is computed and painted by animateChartWindow, so
      // Chart.js must not also animate. Left on, it interpolates element positions toward each
      // frame's target while the target is itself still moving: the drawn line trails the scale
      // (visible as the line distorting mid-zoom) and then snaps into place when the zoom stops.
      // resize() in particular starts one of these on every width change.
      animation: false,
      animations: { colors: false, numbers: false },
      transitions: { resize: { animation: { duration: 0 } }, active: { animation: { duration: 0 } } },
      interaction,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.parsed.y !== null,
          callbacks: {
            title: (items) => {
              const d = view.dates[Math.round(items[0].parsed.x)];
              return d ? formatDate(d) : '';
            },
            label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + ' kg',
          },
        },
      },
      // includeBounds:false — with an explicit min/max, Chart.js also forces a tick at each
      // bound, which sits right next to the first generated one and overlaps its label.
      // Both axes are pinned to a fixed size so the plotting rectangle is identical in every
      // range. Left to itself Chart.js sizes them from their content, and that content changes
      // with the range: the y column widens or narrows with the label text ("76.9" vs "84.1",
      // worse once a weight reaches three digits), and the x row grows taller whenever it
      // decides to tilt the dates to fit more of them in. Either one moves the chart box edge.
      scales: {
        x: {
          type: 'linear',
          afterFit: (s) => {
            s.height = AXIS.xHeight;
            s.paddingLeft = AXIS.xPad;
            s.paddingRight = AXIS.xPad;
          },
          ticks: {
            color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, maxTicksLimit: tickLimit, autoSkip: true,
            includeBounds: false, maxRotation: 0, minRotation: 0, padding: AXIS.tickPad,
            callback: (v) => {
              const d = view.dates[Math.round(v)];
              return d ? formatDayMonth(d) : '';
            },
          },
          // tickLength:0 — the default draws an 8px stub of every gridline OUTSIDE the plot
          // rectangle, into the label strip, which is the grid poking past the bottom edge.
          grid: { color: CHART_THEME.grid, tickLength: 0 },
        },
        // The vertical lines span the full box height, so unless a horizontal line sits exactly
        // on the top and bottom edges the grid looks like it runs past the last one. The bounds
        // here are data-derived (min/max plus padding), never round numbers, so ticks generated
        // at "nice" values stop short of them. Asking for a fixed count of evenly spaced ticks
        // puts the first and last exactly on the bounds, closing the box on all four sides.
        y: {
          afterFit: (s) => { s.width = AXIS.yWidth; },
          ticks: {
            color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, count: 6, includeBounds: true, padding: AXIS.tickPad,
            callback: (v) => v.toFixed(1),
          },
          grid: { color: CHART_THEME.grid, tickLength: 0 },
        },
      },
    },
  });
}

export function renderWeightChart() {
  const dates = buildDayAxis(state.entries);
  const win = rangeWindow(view.range, dates, state.goal);
  const layout = rangeLayout(view.range, win.end - win.start + 1);
  const datasets = buildDatasets(dates, layout);
  const interaction = interactionFor(layout.pointsVisible);

  view.dates = dates;
  view.pxPerDay = PX_PER_DAY;
  view.scrollable = layout.scrollable;

  if (!view.chart) {
    view.chart = createChart(datasets, interaction, layout.tickLimit);
    view.win = { min: win.start, max: win.end };
    applyFinalLayout(win.start, win.end);
    return;
  }

  const chart = view.chart;
  chart.data.datasets = datasets;
  // Whether points are drawn changes with the range, so the hover mode has to follow it.
  Object.assign(chart.options.interaction, interaction);
  if (view.transitionQueued) {
    // maxTicksLimit is deliberately left alone here — animateChartWindow applies it mid-zoom,
    // while the labels are hidden, so the change never shows as a reshuffle.
    view.transitionQueued = false;
    animateChartWindow(win.start, win.end, layout.tickLimit, view.win);
  } else {
    // Not a range switch — make sure the axes are fully opaque and back on automatic ticks,
    // in case a zoom was interrupted partway through its fade.
    cancelAnimation();
    chart.options.scales.x.ticks.maxTicksLimit = layout.tickLimit;
    setAxisChrome(1, false);
    view.win = { min: win.start, max: win.end };
    applyFinalLayout(win.start, win.end);
  }
}

// Browsers restore <select> state across reloads and back-navigation, which would leave the
// dropdown showing one range while the chart still used the default — the chart and its own
// label disagreeing. Force the control back to the default so the two can't drift apart.
export function initRangeSelect(onChange) {
  const select = byId('chart-range');
  select.value = view.range;
  select.addEventListener('change', () => {
    view.transitionQueued = true;
    view.range = select.value;
    onChange();
  });
}
