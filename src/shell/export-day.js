// A one-screen summary of a single training day as a self-contained HTML file, made to be
// screenshotted or sent as is: per exercise, the tonnage of its last sessions as a tiny bar chart
// and only the latest entry of each set. Data comes from the Exercises report builder.
import { esc, plural } from '../lib/html.js';
import { today, formatDate, formatDateShort } from '../lib/dates.js';
import { sparkBars } from '../lib/svg-charts.js';
import { dayReport } from '../features/exercises/index.js';

const SESSIONS = 6;
const tons = (n) => Math.round(n).toLocaleString('en-US');
const wt = (n) => String(Math.round(n * 100) / 100);

/** One set's latest entry: "10 × 62.5", or "L10 R9 × 22.5" for a left/right set. */
function setChip(s, bodyweight) {
  if (!s.row) return '<span class="c none">–</span>';
  const sides = s.row.sides;
  // 0 kg on a body-weight exercise means "just your body", not an empty bar.
  const weights = Array.from(new Set(sides.map((sd) => (bodyweight && sd.weight === 0 ? 'BW' : wt(sd.weight)))));
  const reps = sides.map((sd, i) => `<b class="${sd.state}">${sides.length > 1 ? (i ? 'R' : 'L') : ''}${sd.reps}</b>`).join(' ');
  return `<span class="c"><i>${s.k + 1}</i>${reps}<span class="x">× ${weights.join(' / ')}</span></span>`;
}

function trend(tonnage) {
  const last = tonnage[tonnage.length - 1], prev = tonnage[tonnage.length - 2];
  let d = '';
  if (prev && prev.total) {
    const pct = ((last.total - prev.total) / prev.total) * 100;
    d = `<span class="d ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span>`;
  }
  return `<span><b>${tons(last.total)}</b> <span class="kg">kg</span></span>${d}`;
}

function row(x) {
  const tags = (x.unilateral ? '<span class="tag">L/R</span>' : '') + (x.bodyweight ? '<span class="tag">BW</span>' : '') +
    (x.machine ? `<span class="tag m">${esc(x.machine)}</span>` : '');
  const name = `<div class="nm">${esc(x.name)}<div class="tags">${tags}</div></div>`;
  const n = x.tonnage.length;
  if (!n) return `<div class="row">${name}<span class="none span2">No entries yet</span></div>`;
  const bars = x.tonnage.map((d, i) => ({
    value: d.total, highlight: i === n - 1, title: `${formatDateShort(d.date)} · ${tons(d.total)} kg`,
  }));
  const spark = sparkBars({ bars, slots: SESSIONS, label: `Tonnage of the last ${n} sessions of ${x.name}` });
  return `<div class="row">${name}` +
    `<div class="ton">${spark}<div class="tn">${trend(x.tonnage)}<span class="sess">${n} ${plural(n, 'session')}</span></div></div>` +
    `<div class="last"><span class="dt">${x.lastDate ? esc(formatDateShort(x.lastDate)) : ''}</span>` +
    `<div class="chips">${x.sets.map((st) => setChip(st, x.bodyweight)).join('')}</div></div></div>`;
}

const CSS = `
:root{color-scheme:light dark;--bg:#f4f7f8;--surface:#fff;--text:#162126;--muted:#566a72;--border:#dbe4e7;--accent:#0a7c6e;--up:#0a7c6e;--down:#b3261e;--tag:#eef3f4;--warn:#8a5a00;--warn-bg:#fdf0cf}
@media (prefers-color-scheme:dark){:root{--bg:#0f1417;--surface:#182024;--text:#e4eef0;--muted:#8c9ea5;--border:#223036;--accent:#5fd4c4;--up:#5fd4c4;--down:#ff7b7b;--tag:#222c31;--warn:#f2c46d;--warn-bg:#3b2e12}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.sheet{max-width:620px;margin:0 auto;padding:16px}
h1{margin:0;font-size:24px}.sub{margin:2px 0 12px;color:var(--muted);font-size:13px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.hd,.row{display:grid;grid-template-columns:minmax(0,1.1fr) 200px minmax(0,1.3fr);gap:12px;align-items:center;padding:10px 14px}
.hd{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--border);padding-top:8px;padding-bottom:8px}
.row+.row{border-top:1px solid var(--border)}.nm{font-weight:600;font-size:15px}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.tags:empty{display:none}.span2{grid-column:2/4}
.tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;background:var(--tag);color:var(--muted);vertical-align:middle}.tag.m{background:var(--warn-bg);color:var(--warn)}
.ton{display:flex;align-items:center;gap:10px}.spark .col{fill:var(--accent);opacity:.5}.spark .col.hi{opacity:1}
.tn{display:flex;flex-direction:column;line-height:1.25;white-space:nowrap}.tn b{font-size:15px}.tn .kg{font-size:12px;color:var(--muted)}.sess,.none,.dt{font-size:11px;color:var(--muted)}
.d{font-size:11px;font-weight:600}.d.up{color:var(--up)}.d.down{color:var(--down)}
.last{display:flex;flex-direction:column;gap:3px}.chips{display:flex;flex-wrap:wrap;gap:4px}
.c{display:inline-flex;align-items:baseline;gap:4px;padding:2px 7px;border-radius:7px;background:var(--tag);font-size:12.5px;white-space:nowrap}
.c i{font-style:normal;font-size:10px;color:var(--muted)}.c .x{color:var(--muted);font-size:11.5px}.c b{font-weight:700}.c b.up{color:var(--up)}.c b.down{color:var(--down)}
.foot{margin-top:8px;font-size:11px;color:var(--muted)}
@media (max-width:520px){.hd{display:none}.row{grid-template-columns:1fr;gap:6px}}
`;

/** The day summary as one HTML string, or null if the day can't be found. */
export function buildDayHtml(dayId) {
  const r = dayReport(dayId);
  if (!r) return null;
  const title = `${r.name} · ${formatDate(today())}`;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${esc(title)}</title><style>${CSS}</style></head><body><main class="sheet">` +
    `<h1>${esc(r.name)}</h1><p class="sub">${esc(formatDate(today()))}</p>` +
    '<div class="panel"><div class="hd"><span>Exercise</span><span>Tonnage · last 6 sessions</span><span>Last entry per set</span></div>' +
    (r.exercises.length ? r.exercises.map(row).join('') : '<div class="row"><span class="none">No exercises in this day.</span></div>') +
    '</div><p class="foot">Tonnage = reps × weight, added up over every set (kg). Reps: ' +
    '<b style="color:var(--up)">green</b> above and <b style="color:var(--down)">red</b> below the target range.</p>' +
    '</main></body></html>';
}

export function dayFileName(dayId) {
  const r = dayReport(dayId);
  const slug = (r ? r.name : 'day').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'day';
  return `training-${slug}-${today()}.html`;
}
