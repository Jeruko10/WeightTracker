// Tiny SVG chart builders that return markup as strings. Used by the HTML report, which must be a
// single self-contained file (no Chart.js, no network). Colours come from CSS classes and
// variables defined by the page that embeds the SVG; nothing here knows about the app.
import { esc } from './html.js';

const PAD = { top: 12, right: 14, bottom: 26, left: 44 };

/** A round step (1, 2, 5 × 10ⁿ) that gives roughly `count` ticks over [min, max]. */
function niceStep(min, max, count) {
  const raw = (max - min) / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Tick values covering [min, max], extended outward to round numbers. */
export function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(min, max, count);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function frame(width, height, label, inner) {
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" ` +
    `preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

const num = (n) => (Math.round(n * 100) / 100).toString();

/**
 * Line chart. `series`: [{ cls, dashed, dots, points: [{ x, y, title }] }] where x is any number
 * (e.g. days since a base date). `xTicks`: [{ x, label }]. Hovering a dot shows its `title`.
 */
export function lineChart({
  width = 640, height = 240, series, xTicks = [], yFormat = String, label = 'Line chart', yPad = 0.08,
}) {
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return '';
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yLo = Math.min(...ys), yHi = Math.max(...ys);
  const span = (yHi - yLo) || 1;
  yLo -= span * yPad; yHi += span * yPad;
  const ticks = niceTicks(yLo, yHi, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const W = width - PAD.left - PAD.right, H = height - PAD.top - PAD.bottom;
  const sx = (x) => PAD.left + (xMax === xMin ? W / 2 : ((x - xMin) / (xMax - xMin)) * W);
  const sy = (y) => PAD.top + H - ((y - y0) / ((y1 - y0) || 1)) * H;

  let g = '';
  ticks.forEach((t) => {
    g += `<line class="grid" x1="${PAD.left}" x2="${width - PAD.right}" y1="${num(sy(t))}" y2="${num(sy(t))}"/>` +
      `<text class="tick" x="${PAD.left - 6}" y="${num(sy(t) + 4)}" text-anchor="end">${esc(yFormat(t))}</text>`;
  });
  xTicks.forEach((t) => {
    g += `<text class="tick" x="${num(sx(t.x))}" y="${height - 8}" text-anchor="middle">${esc(t.label)}</text>`;
  });
  series.forEach((s) => {
    if (!s.points.length) return;
    const d = s.points.map((p, i) => (i ? 'L' : 'M') + num(sx(p.x)) + ' ' + num(sy(p.y))).join('');
    if (s.points.length > 1) g += `<path class="line ${s.cls || ''}${s.dashed ? ' dashed' : ''}" d="${d}"/>`;
    if (s.dots) {
      s.points.forEach((p) => {
        g += `<circle class="dot ${s.cls || ''}" cx="${num(sx(p.x))}" cy="${num(sy(p.y))}" r="${s.points.length > 60 ? 2 : 3.5}">` +
          (p.title ? `<title>${esc(p.title)}</title>` : '') + '</circle>';
      });
    }
  });
  return frame(width, height, label, g);
}

/**
 * Bar chart with a zero baseline. `bars`: [{ label, value, title, highlight }]. Values are printed
 * above the bars when there are few enough to read.
 */
export function barChart({
  width = 640, height = 200, bars, valueFormat = String, label = 'Bar chart',
}) {
  if (!bars.length) return '';
  const max = Math.max(...bars.map((b) => b.value), 0);
  const ticks = niceTicks(0, max || 1, 3);
  const top = ticks[ticks.length - 1];
  const W = width - PAD.left - PAD.right, H = height - PAD.top - PAD.bottom;
  const slot = W / bars.length, bw = Math.min(46, slot * 0.7);
  const sy = (v) => PAD.top + H - (v / (top || 1)) * H;
  let g = '';
  ticks.forEach((t) => {
    g += `<line class="grid" x1="${PAD.left}" x2="${width - PAD.right}" y1="${num(sy(t))}" y2="${num(sy(t))}"/>` +
      `<text class="tick" x="${PAD.left - 6}" y="${num(sy(t) + 4)}" text-anchor="end">${esc(valueFormat(t))}</text>`;
  });
  bars.forEach((b, i) => {
    const cx = PAD.left + slot * i + slot / 2, y = sy(b.value);
    g += `<rect class="col${b.highlight ? ' hi' : ''}" x="${num(cx - bw / 2)}" y="${num(y)}" width="${num(bw)}" ` +
      `height="${num(Math.max(0, PAD.top + H - y))}" rx="3"><title>${esc(b.title || valueFormat(b.value))}</title></rect>` +
      `<text class="tick" x="${num(cx)}" y="${height - 8}" text-anchor="middle">${esc(b.label)}</text>`;
    if (bars.length <= 12) g += `<text class="val" x="${num(cx)}" y="${num(y - 4)}" text-anchor="middle">${esc(valueFormat(b.value))}</text>`;
  });
  return frame(width, height, label, g);
}
