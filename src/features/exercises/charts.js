import { formatDateShort, formatDayMonth } from '../../lib/dates.js';
import { COLORS, CHART_THEME } from '../../shared/theme.js';
import { CHART_ENTRIES } from './constants.js';
import { state } from './state.js';
import { findById, trackOf } from './selectors.js';
import { tonnageSeries } from './tonnage.js';
import { bodyweightLookup } from './bodyweight-source.js';

const charts = {}; // exerciseId → Chart instance

export function destroyChart(exId) {
  if (!charts[exId]) return;
  charts[exId].destroy();
  delete charts[exId];
}

export function destroyCharts() {
  Object.keys(charts).forEach(destroyChart);
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function mountChart(exId) {
  destroyChart(exId);
  const x = findById(state.exercises, exId);
  const canvas = document.querySelector(`#ex-detail canvas[data-chart="${exId}"]`);
  if (!x || !canvas || typeof Chart === 'undefined') return;
  const lookup = bodyweightLookup();
  const days = tonnageSeries(x, trackOf(x), lookup).days.slice(-CHART_ENTRIES);
  const estimated = (d) => x.bodyweight && lookup.firstDate && d.date < lookup.firstDate;
  const last = days.length - 1;
  charts[exId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days.map((d) => d.date),
      datasets: [{
        data: days.map((d) => d.total),
        // The latest session at full strength, earlier ones softer (still clearly visible).
        backgroundColor: days.map((_, i) => (i === last ? COLORS.accent : COLORS.accentMuted)),
        borderRadius: 4, maxBarThickness: 36,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = days[items[0].dataIndex];
              return formatDateShort(d.date) + ' · ' + fmt(d.total) + ' kg' + (estimated(d) ? ' *' : '');
            },
            label: (ctx) => days[ctx.dataIndex].parts.map((p) => 'Set ' + (p.set + 1) + ': ' + fmt(p.tonnage) + ' kg'),
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, maxRotation: 0, autoSkip: true,
            // `this` is the scale: a regular function is required here.
            callback: function (v) {
              const d = days[v];
              return d ? formatDayMonth(d.date) + (estimated(d) ? '*' : '') : '';
            },
          },
          grid: { display: false },
        },
        // Bars always start from zero, so their heights compare honestly.
        y: {
          beginAtZero: true,
          ticks: { color: CHART_THEME.tick, font: { size: CHART_THEME.fontSize }, precision: 0, callback: (v) => fmt(v) },
          grid: { color: CHART_THEME.grid, tickLength: 0 },
        },
      },
    },
  });
}
