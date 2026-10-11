// Per-exercise reps chart, mounted only while its fold is open.
import { formatDateShort, formatDayMonth } from '../../lib/dates.js';
import { COLORS, CHART_THEME } from '../../shared/theme.js';
import { CHART_ENTRIES, SET_COLORS } from './constants.js';
import { state } from './state.js';
import { setLogs, uniformRange, formatWeight, findById } from './selectors.js';

const charts = {}; // exerciseId → Chart instance

export function destroyChart(exId) {
  if (!charts[exId]) return;
  charts[exId].destroy();
  delete charts[exId];
}

export function destroyCharts() {
  Object.keys(charts).forEach(destroyChart);
}

// Shades the target rep range when every set shares it — with mixed ranges one band would lie.
function repBandPlugin(band) {
  return {
    id: 'repBand',
    beforeDatasetsDraw(c) {
      if (!band) return;
      const a = c.chartArea, y = c.scales.y, ctx = c.ctx;
      const top = Math.max(a.top, y.getPixelForValue(band.max));
      const bottom = Math.min(a.bottom, y.getPixelForValue(band.min));
      if (bottom <= top) return;
      ctx.save();
      ctx.fillStyle = COLORS.accentBand;
      ctx.fillRect(a.left, top, a.right - a.left, bottom - top);
      ctx.restore();
    },
  };
}

export function mountChart(exId) {
  destroyChart(exId);
  const x = findById(state.exercises, exId);
  const canvas = document.querySelector(`#ex-tree canvas[data-chart="${exId}"]`);
  if (!x || !canvas) return;
  const dates = new Set();
  const datasets = x.sets.map((s, k) => {
    const pts = setLogs(x.id, s.id).slice(-CHART_ENTRIES);
    pts.forEach((p) => dates.add(p.date));
    return {
      label: 'Set ' + (k + 1),
      data: pts.map((p) => ({ x: p.date, y: p.reps, w: p.weight })),
      borderColor: SET_COLORS[k], backgroundColor: SET_COLORS[k], borderWidth: 2,
      pointRadius: 3, pointHoverRadius: 5, pointHitRadius: 8, tension: 0,
    };
  });
  const band = uniformRange(x) ? x.sets[0] : null;
  charts[exId] = new Chart(canvas, {
    type: 'line',
    data: { labels: Array.from(dates).sort(), datasets },
    plugins: [repBandPlugin(band)],
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      // 'x' gathers every set logged on the hovered date into one tooltip.
      interaction: { mode: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? formatDateShort(items[0].raw.x) : ''),
            label: (ctx) => ctx.dataset.label + ': ' + ctx.raw.y + ' reps × ' + formatWeight(ctx.raw.w) + ' kg',
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, maxRotation: 0, autoSkip: true,
            // `this` is the scale: a regular function is required here.
            callback: function (v) { return formatDayMonth(this.getLabelForValue(v)); },
          },
          grid: { color: CHART_THEME.grid, tickLength: 0 },
        },
        y: {
          suggestedMin: band ? band.min - 1 : undefined,
          suggestedMax: band ? band.max + 1 : undefined,
          ticks: { color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, precision: 0 },
          grid: { color: CHART_THEME.grid, tickLength: 0 },
        },
      },
    },
  });
}
