// Self-contained: one file, no network.
import { esc, plural } from '../lib/html.js';
import { today, formatDate, formatDateShort, formatDayMonth, addDays, daysBetween } from '../lib/dates.js';
import { lineChart, barChart } from '../lib/svg-charts.js';
import { weightLabel } from '../shared/export-format.js';
import { exercisesReport } from '../features/exercises/index.js';
import { bodyweightReport } from '../features/bodyweight/index.js';

const RANGES = [['1M', 30], ['3M', 90], ['6M', 180], ['All', 0]];
const WEEKS_SHOWN = 8;
const WEIGH_INS_SHOWN = 10;

const kg = (n, d = 1) => Number(n).toFixed(d) + ' kg';
const tons = (n) => Math.round(n).toLocaleString('en-US');
const fmtAxis = (v) => String(Math.round(v * 10) / 10);
const signed = (n, d = 1) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
const REPS_LABEL = { up: ['▲', 'above range'], in: ['●', 'in range'], down: ['▼', 'below range'] };

// ── Small layout helpers ──────────────────────────────────────────────────────
// Without JavaScript every panel simply shows.
function tabs(labels, panels, selected = 0) {
  return `<div class="tabs" data-tabs data-default="${selected}"><div class="tablist" role="tablist">` +
    labels.map((l) => `<button type="button" role="tab">${esc(l)}</button>`).join('') + '</div>' +
    panels.map((p) => `<div class="tabpanel" role="tabpanel">${p}</div>`).join('') + '</div>';
}

function card(label, value, sub, extra = '') {
  return `<div class="card"><div class="k">${esc(label)}</div><div class="v">${value}</div>` +
    (sub ? `<div class="s">${sub}</div>` : '') + extra + '</div>';
}

function details(summary, body, { open = false, cls = '' } = {}) {
  return `<details class="${cls}"${open ? ' open' : ''}><summary>${summary}</summary><div class="body">${body}</div></details>`;
}

// ── At a glance ───────────────────────────────────────────────────────────────
function weightCard(bw) {
  if (!bw || !bw.latest) return card('Body weight', 'No data', 'No weigh-ins recorded yet.');
  let change = 'Not enough data for a weekly comparison yet.';
  if (bw.prevAvg !== null) {
    const d = bw.curAvg - bw.prevAvg;
    change = `${d > 0.05 ? '▲' : d < -0.05 ? '▼' : '●'} ${signed(d)} kg vs the previous 7 days`;
  }
  return card('Body weight · 7-day average', esc(kg(bw.curAvg)), esc(change) +
    `<br>Latest weigh-in ${esc(kg(bw.latest.weight))} on ${esc(formatDate(bw.latest.date))}`);
}

function goalCard(g) {
  if (!g) return card('Goal', 'No goal set', 'There is no active weight goal.');
  const title = `${g.isBulk ? 'Gain' : 'Lose'} to ${kg(g.target)}`;
  if (g.progress === undefined) return card('Goal', esc(title), `by ${esc(formatDate(g.end))}`);
  const pct = Math.round(g.progress * 100);
  let status;
  if (g.reached) status = 'Goal reached.';
  else if (g.pastDue) status = `The target date has passed; ${kg(g.remainingKg)} still to go.`;
  else if (Math.abs(g.aheadKg) < 0.15) status = 'On plan.';
  else status = `${kg(Math.abs(g.aheadKg))} ${g.aheadKg > 0 ? 'ahead of' : 'behind'} plan.`;
  const left = Math.max(0, daysBetween(today(), g.end));
  const bar = `<div class="bar" role="img" aria-label="${pct}% of the way"><i style="width:${pct}%"></i></div>`;
  return card('Goal', esc(title),
    `${esc(status)}<br>${pct}% of the way · ${esc(kg(g.remainingKg))} to go<br>by ${esc(formatDate(g.end))}` +
    (g.reached || g.pastDue ? '' : ` (${left} ${plural(left, 'day')} left)`), bar);
}

function trainingCard(ex) {
  if (!ex) return card('Training', 'No data', '');
  const ago = ex.lastWorkout ? daysBetween(ex.lastWorkout, today()) : 0;
  const last = ex.lastWorkout
    ? `Last workout ${esc(formatDate(ex.lastWorkout))} (${ago === 0 ? 'today' : ago + ' ' + plural(ago, 'day') + ' ago'})` : 'No workouts logged yet';
  return card('Training', `${ex.sessionsLast7} ${plural(ex.sessionsLast7, 'workout')}`, `in the last 7 days<br>${last}`);
}

function deloadCard(ex) {
  const d = ex && ex.deload;
  if (!d || (!d.phase && !d.nextDate)) return card('Deload', 'None recorded', 'No deload cycles marked yet.');
  const bits = [];
  if (d.lastDate) bits.push(`Last started ${esc(formatDate(d.lastDate))} (${d.daysAgo === 0 ? 'today' : d.daysAgo + ' ' + plural(d.daysAgo, 'day') + ' ago'})`);
  if (d.nextDate) bits.push(`Next planned ${esc(formatDate(d.nextDate))}`);
  return card('Deload', esc(d.phase ? d.phase.text : 'Upcoming'), bits.join('<br>'));
}

// ── Bodyweight ────────────────────────────────────────────────────────────────
function rangePanel(bw, days) {
  const last = bw.points[bw.points.length - 1].date;
  const from = days ? addDays(last, -(days - 1)) : bw.points[0].date;
  const pts = bw.points.filter((p) => p.date >= from);
  if (pts.length < 2) return '<p class="muted">Not enough weigh-ins in this period.</p>';
  const base = pts[0].date, dx = (d) => daysBetween(base, d);
  const series = [
    { cls: 'raw', dots: true, points: pts.map((p) => ({ x: dx(p.date), y: p.weight, title: `${formatDateShort(p.date)} · ${kg(p.weight)}` })) },
    { cls: 'avg', points: pts.map((p) => ({ x: dx(p.date), y: p.avg })) },
  ];
  const g = bw.goal;
  if (g && g.startWeight !== null && g.startWeight !== undefined) {
    const total = Math.max(1, daysBetween(g.start, g.end));
    const at = (d) => g.startWeight + (g.target - g.startWeight) * (daysBetween(g.start, d) / total);
    const a = g.start > from ? g.start : from, b = g.end < last ? g.end : last;
    if (a < b) series.push({ cls: 'plan', dashed: true, points: [{ x: dx(a), y: at(a) }, { x: dx(b), y: at(b) }] });
  }
  const span = dx(pts[pts.length - 1].date), steps = Math.min(4, span);
  const xTicks = Array.from({ length: steps + 1 }, (_, i) => {
    const x = Math.round((span * i) / steps);
    return { x, label: formatDayMonth(addDays(base, x)) };
  });
  return lineChart({ series, xTicks, yFormat: fmtAxis, label: 'Body weight over time' });
}

function bodyweightSection(bw) {
  if (!bw || !bw.n) return '<p class="muted">No weigh-ins recorded yet.</p>';
  const withData = RANGES.filter(([, d]) => !d || bw.points.length > 1);
  const selected = Math.max(0, withData.findIndex(([l]) => l === '3M'));
  const chart = tabs(withData.map(([l]) => l), withData.map(([, d]) => rangePanel(bw, d)), selected);
  const legend = '<p class="legend"><span class="sw raw"></span>Weigh-in <span class="sw avg"></span>7-day average' +
    (bw.goal ? ' <span class="sw plan"></span>Goal pace' : '') + '</p>';
  const weekRow = (w) => {
    const [year, wk] = w.key.split('-W');
    return `<tr><td>Week ${esc(wk)}, ${esc(year)}</td><td>${esc(kg(w.avg))}</td><td>${w.n} ${plural(w.n, 'weigh-in')}</td></tr>`;
  };
  const table = (rows) => `<table><thead><tr><th>Week</th><th>Average</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  const weeks = table(bw.weekly.slice(0, WEEKS_SHOWN).map(weekRow).join('')) +
    (bw.weekly.length > WEEKS_SHOWN ? details('Earlier weeks', table(bw.weekly.slice(WEEKS_SHOWN).map(weekRow).join(''))) : '');
  const entry = (p) => `<tr><td>${esc(formatDate(p.date))}</td><td>${esc(kg(p.weight))}</td></tr>`;
  const list = (ps) => `<table><thead><tr><th>Date</th><th>Weight</th></tr></thead><tbody>${ps.map(entry).join('')}</tbody></table>`;
  const recent = bw.points.slice(-WEIGH_INS_SHOWN).reverse();
  const all = bw.points.slice().reverse();
  return chart + legend + '<h3>Weekly averages</h3>' + weeks + '<h3>Weigh-ins</h3>' + list(recent) +
    (all.length > WEIGH_INS_SHOWN ? details(`All ${all.length} weigh-ins`, list(all)) : '');
}

// ── Training ──────────────────────────────────────────────────────────────────
function repsBadge(side) {
  const [icon, text] = REPS_LABEL[side.state];
  return `<span class="reps ${side.state}" title="${text}"><b>${side.reps}</b> reps <span class="mk">${icon} ${text}</span></span>`;
}

function historyRow(row, bodyweight) {
  const cells = row.sides.map((sd, i) => {
    const tag = row.sides.length > 1 ? `<span class="lr">${i ? 'R' : 'L'}</span>` : '';
    return `<div class="side">${tag}${repsBadge(sd)}<span class="wt">${esc(weightLabel(sd.weight, bodyweight))}</span></div>`;
  }).join('');
  return `<tr><td class="d">${esc(formatDateShort(row.date))}</td><td>${cells}</td></tr>`;
}

function trackPanel(x, t) {
  let h = '';
  if (!t.tonnage.length) {
    h += '<p class="muted">No entries on this track yet.</p>';
  } else {
    const bars = t.tonnage.map((d, i) => ({
      label: formatDayMonth(d.date), value: d.total, highlight: i === t.tonnage.length - 1,
      title: `${formatDateShort(d.date)} · ${tons(d.total)} kg\n` + d.parts.map((p) => `Set ${p.set + 1}: ${tons(p.tonnage)} kg`).join('\n'),
    }));
    h += `<div class="cap">Tonnage per session (kg) — reps × weight, added up over every set${x.unilateral ? ' and both sides' : ''}</div>` +
      barChart({ bars, valueFormat: tons, label: `Tonnage per session for ${x.name}` });
    if (x.bodyweightMissing) h += '<p class="note warn">Body weight is not included: no weigh-ins were recorded.</p>';
    else if (x.bodyweight) h += '<p class="note">Includes body weight (7-day average at each date)' +
      (t.estimated ? '; earlier sessions use the first weigh-in as an estimate' : '') + '.</p>';
  }
  h += t.sets.map((s) => `<div class="setbox"><div class="setname">Set ${s.k + 1} <span class="muted">· target ${esc(s.range)} reps</span></div>` +
    (s.rows.length ? `<table class="hist"><tbody>${s.rows.map((r) => historyRow(r, x.bodyweight)).join('')}</tbody></table>`
      : '<p class="muted">No entries yet.</p>') + '</div>').join('');
  return h;
}

function exerciseBlock(x) {
  const active = x.tracks.find((t) => t.active) || x.tracks[0];
  const lastDay = active && active.tonnage.length ? active.tonnage[active.tonnage.length - 1] : null;
  const tags = (x.unilateral ? '<span class="tag">Left / right</span>' : '') +
    (x.bodyweight ? '<span class="tag">Body weight</span>' : '') +
    (x.machine ? `<span class="tag">${esc(x.machine)}</span>` : '');
  const sum = `<span class="nm">${esc(x.name)}</span>${tags}` +
    `<span class="last">${lastDay ? `${esc(formatDateShort(lastDay.date))} · ${tons(lastDay.total)} kg` : 'no entries'}</span>`;
  let body = `<p class="muted">${x.setCount} ${plural(x.setCount, 'set')}</p>`;
  if (x.tracks.length > 1) {
    const labels = x.tracks.map((t) => (t.label || 'No label') + (t.active ? ' (current)' : ''));
    body += '<p class="note">This exercise was done on different machines. Each one is tracked separately, since the same effort can mean different weights.</p>' +
      tabs(labels, x.tracks.map((t) => trackPanel(x, t)), Math.max(0, x.tracks.indexOf(active)));
  } else {
    body += x.tracks.length ? trackPanel(x, x.tracks[0]) : '<p class="muted">No entries yet.</p>';
  }
  return details(sum, body, { cls: 'ex' });
}

function trainingSection(ex) {
  if (!ex) return '<p class="muted">Training data was still loading.</p>';
  if (!ex.days.length) return '<p class="muted">No training days yet.</p>';
  const tools = '<div class="tools"><button type="button" data-expand="all">Expand all</button>' +
    '<button type="button" data-expand="none">Collapse all</button></div>' +
    '<p class="legend"><span class="mk up">▲ above</span> <span class="mk in">● within</span> <span class="mk down">▼ below</span> the target rep range</p>';
  return tools + ex.days.map((d) => {
    const lastDates = d.exercises.flatMap((x) => x.tracks.map((t) => t.lastDate)).filter(Boolean).sort();
    const meta = `${d.exercises.length} ${plural(d.exercises.length, 'exercise')}` +
      (lastDates.length ? ` · last trained ${formatDateShort(lastDates[lastDates.length - 1])}` : '');
    return details(`<span class="dn">${esc(d.name)}</span><span class="meta">${esc(meta)}</span>`,
      d.exercises.length ? d.exercises.map(exerciseBlock).join('') : '<p class="muted">No exercises in this day.</p>', { open: true, cls: 'day' });
  }).join('');
}

// ── Page ──────────────────────────────────────────────────────────────────────
const CSS = `
:root{color-scheme:light dark;--bg:#f4f7f8;--surface:#fff;--sunken:#eef3f4;--text:#162126;--soft:#3d4f56;--muted:#566a72;--border:#dbe4e7;--accent:#0a7c6e;--accent-bg:#d5f2ed;--up:#0a7c6e;--down:#b3261e;--warn:#8a5a00;--warn-bg:#fdf0cf;--raw:#7a8d94;--grid:rgba(0,0,0,.08)}
@media (prefers-color-scheme:dark){:root{--bg:#0f1417;--surface:#182024;--sunken:#12191c;--text:#e4eef0;--soft:#b8c6cb;--muted:#8c9ea5;--border:#223036;--accent:#5fd4c4;--accent-bg:#123a36;--up:#5fd4c4;--down:#ff7b7b;--warn:#f2c46d;--warn-bg:#3b2e12;--raw:#8c9ea5;--grid:rgba(255,255,255,.07)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:16px 16px 48px}
header h1{margin:8px 0 2px;font-size:26px}header p{margin:0;color:var(--muted)}
nav{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
nav a{padding:6px 14px;border-radius:99px;background:var(--surface);color:var(--soft);text-decoration:none;font-size:14px;border:1px solid var(--border)}
nav a:hover{color:var(--accent)}
h2{margin:30px 0 10px;font-size:20px}h3{margin:20px 0 6px;font-size:15px;color:var(--soft)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px}
.card .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.card .v{font-size:24px;font-weight:700;margin:4px 0}.card .s{font-size:13px;color:var(--soft)}
.bar{height:8px;border-radius:4px;background:var(--sunken);margin-top:10px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent)}
section>.panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px}
.muted{color:var(--muted)}.note{font-size:13px;color:var(--soft);margin:8px 0}.note.warn{color:var(--warn)}
.tablist{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.tablist button,.tools button{padding:6px 14px;border-radius:99px;border:1px solid var(--border);background:var(--sunken);color:var(--soft);font:inherit;font-size:13px;cursor:pointer}
.tablist button[aria-selected=true]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent);font-weight:600}
.tools{display:flex;gap:8px;margin-bottom:8px}[hidden]{display:none!important}
.chart{width:100%;height:auto;display:block}.chart .grid{stroke:var(--grid);stroke-width:1}.chart .tick{fill:var(--muted);font-size:11px}
.chart .line{fill:none;stroke-width:2.2}.chart .line.avg{stroke:var(--accent)}.chart .line.plan{stroke:var(--warn);stroke-width:1.6}.chart .dashed{stroke-dasharray:6 4}
.chart .dot.raw{fill:var(--raw);opacity:.75}.chart .col{fill:var(--accent);opacity:.55}.chart .col.hi{opacity:1}.chart .val{fill:var(--soft);font-size:10px}
.legend{font-size:13px;color:var(--soft);margin:6px 0}.sw{display:inline-block;width:14px;height:3px;border-radius:2px;margin:0 4px 3px 10px;vertical-align:middle}
.sw.raw{background:var(--raw)}.sw.avg{background:var(--accent)}.sw.plan{background:var(--warn)}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:var(--muted);font-weight:500;padding:4px 6px;border-bottom:1px solid var(--border)}td{padding:6px;border-bottom:1px solid var(--border)}
details{margin:8px 0}summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;background:var(--sunken)}
summary::-webkit-details-marker{display:none}summary::before{content:'▸';color:var(--muted);transition:transform .15s}details[open]>summary::before{transform:rotate(90deg)}
details.day>summary{background:var(--surface);border:1px solid var(--border);font-weight:600;font-size:17px}.meta{margin-left:auto;font-weight:400;font-size:13px;color:var(--muted)}
details.ex>summary .nm{font-weight:600}.last{margin-left:auto;font-size:13px;color:var(--muted)}
.body{padding:8px 4px 4px 12px}.tag{font-size:11px;font-weight:600;padding:1px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--soft)}
.cap{font-size:13px;color:var(--soft);margin-top:6px}.setbox{margin-top:12px}.setname{font-weight:600;font-size:14px}
table.hist td{border:0;border-bottom:1px solid var(--border);vertical-align:top}.d{color:var(--muted);width:72px;white-space:nowrap}
.side{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.lr{font-size:11px;font-weight:700;width:14px;color:var(--muted)}.wt{margin-left:auto;font-weight:600;white-space:nowrap}
.reps{font-size:14px}.mk{font-size:12px}.reps.up .mk,.mk.up{color:var(--up)}.reps.down .mk,.mk.down{color:var(--down)}.reps.in .mk,.mk.in{color:var(--muted)}
footer{margin-top:36px;font-size:12px;color:var(--muted);border-top:1px solid var(--border);padding-top:12px}
@media print{nav,.tools,.tablist{display:none}.tabpanel[hidden]{display:block!important}body{background:#fff}}
`;

const SCRIPT = `
(function(){
  document.documentElement.classList.add('js');
  document.querySelectorAll('[data-tabs]').forEach(function(g){
    var btns=g.querySelectorAll(':scope > .tablist > button'),panels=g.querySelectorAll(':scope > .tabpanel');
    function show(i){btns.forEach(function(b,j){b.setAttribute('aria-selected',String(i===j))});panels.forEach(function(p,j){p.hidden=i!==j})}
    btns.forEach(function(b,i){b.addEventListener('click',function(){show(i)})});
    show(Number(g.getAttribute('data-default'))||0);
  });
  document.querySelectorAll('[data-expand]').forEach(function(b){b.addEventListener('click',function(){
    var open=b.getAttribute('data-expand')==='all';
    document.querySelectorAll('#training details').forEach(function(d){d.open=open});
  })});
  window.addEventListener('beforeprint',function(){document.querySelectorAll('details').forEach(function(d){d.open=true})});
})();
`;

export function buildHtmlReport() {
  const bw = bodyweightReport(), ex = exercisesReport(), now = today();
  const title = 'Training & body weight report · ' + formatDate(now);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${esc(title)}</title><style>${CSS}</style></head><body><div class="wrap">` +
    `<header><h1>Training &amp; body weight</h1><p>Report generated on ${esc(formatDate(now))}</p></header>` +
    '<nav><a href="#overview">At a glance</a><a href="#bodyweight">Body weight</a><a href="#training">Training</a></nav>' +
    `<section id="overview"><h2>At a glance</h2><div class="cards">${weightCard(bw)}${goalCard(bw && bw.goal)}${trainingCard(ex)}${deloadCard(ex)}</div></section>` +
    `<section id="bodyweight"><h2>Body weight</h2><div class="panel">${bodyweightSection(bw)}</div></section>` +
    `<section id="training"><h2>Training</h2>${trainingSection(ex)}${ex && ex.archivedCount
      ? `<p class="muted">${ex.archivedCount} archived ${plural(ex.archivedCount, 'exercise')} not shown.</p>` : ''}</section>` +
    '<footer>Averages are 7-day averages; days without a weigh-in are interpolated. Tonnage is reps × weight added up over every set; for body-weight exercises, the weight shown is added to (or, if negative, taken off) body weight first. ' +
    'Hover or tap a chart point for its exact value. Generated by Weight Tracker.</footer>' +
    `</div><script>${SCRIPT}</script></body></html>`;
}

export function reportFileName() {
  return 'weight-tracker-report-' + today() + '.html';
}
