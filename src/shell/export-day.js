import { esc, plural } from '../lib/html.js';
import { today, formatDate, formatDateShort } from '../lib/dates.js';
import { sparkBars } from '../lib/svg-charts.js';
import { weightLabel } from '../shared/export-format.js';
import { dayReport } from '../features/exercises/index.js';

const SESSIONS = 6;
const tons = (n) => Math.round(n).toLocaleString('en-US');

function setLine(s, bodyweight) {
  const label = `<span class="sn">Set ${s.k + 1}</span>`;
  if (!s.row) return `<div class="set">${label}<span class="none">no entry</span></div>`;
  const sides = s.row.sides;
  const reps = sides.map((sd, i) => `<b class="${sd.state}">${sides.length > 1 ? (i ? 'R ' : 'L ') : ''}${sd.reps}</b>`).join(' · ');
  // Body-weight exercises say so on every line: the weight entered is added to the body weight.
  const weights = Array.from(new Set(sides.map((sd) => weightLabel(sd.weight, bodyweight))));
  return `<div class="set">${label}<span class="rp">${reps} <span class="u">${sides[0].reps === 1 && sides.length === 1 ? 'rep' : 'reps'}</span></span>` +
    `<span class="w">× ${weights.join(' / ')}</span></div>`;
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
  // Every tag is the same quiet grey: they describe the exercise, they don't need attention.
  const tags = (x.unilateral ? '<span class="tag">Unilateral</span>' : '') + (x.bodyweight ? '<span class="tag">Body weight</span>' : '') +
    (x.machine ? `<span class="tag">${esc(x.machine)}</span>` : '');
  const name = `<div class="nm">${esc(x.name)}<div class="tags">${tags}</div></div>`;
  const n = x.tonnage.length;
  if (!n) return `<div class="row">${name}<span class="none span2">No entries yet</span></div>`;
  const bars = x.tonnage.map((d, i) => ({
    value: d.total, highlight: i === n - 1, title: `${formatDateShort(d.date)} · ${tons(d.total)} kg`,
  }));
  const spark = sparkBars({ bars, slots: SESSIONS, width: 150, height: 68, label: `Tonnage of the last ${n} sessions of ${x.name}` });
  return `<div class="row">${name}` +
    `<div class="ton">${spark}<div class="tn">${trend(x.tonnage)}<span class="sess">${n} ${plural(n, 'session')}</span></div></div>` +
    `<div class="last"><div class="dt">${x.lastDate ? esc(formatDate(x.lastDate)) : ''}</div>` +
    `<div class="sets">${x.sets.map((st) => setLine(st, x.bodyweight)).join('')}</div></div></div>`;
}

const CSS = `
:root{color-scheme:light dark;--bg:#f4f7f8;--surface:#fff;--text:#162126;--muted:#566a72;--border:#dbe4e7;--accent:#0a7c6e;--up:#0a7c6e;--down:#b3261e;--tag:#eef3f4}
@media (prefers-color-scheme:dark){:root{--bg:#0f1417;--surface:#182024;--text:#e4eef0;--muted:#8c9ea5;--border:#223036;--accent:#5fd4c4;--up:#5fd4c4;--down:#ff7b7b;--tag:#222c31}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.sheet{max-width:880px;margin:0 auto;padding:24px}
h1{margin:0;font-size:34px;letter-spacing:-.5px}.sub{margin:2px 0 16px;color:var(--muted);font-size:15px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.hd,.row{display:grid;grid-template-columns:minmax(0,.9fr) 250px minmax(0,1.3fr);gap:20px;align-items:center;padding:18px 22px}
.hd{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border);padding-top:12px;padding-bottom:12px}
.row+.row{border-top:1px solid var(--border)}.nm{font-weight:650;font-size:19px;line-height:1.25}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.tags:empty{display:none}.span2{grid-column:2/4}
.tag{font-size:12.5px;font-weight:600;padding:2px 9px;border-radius:7px;background:var(--tag);color:var(--muted)}
.ton{display:flex;align-items:center;gap:16px}.spark .col{fill:var(--accent);opacity:.5}.spark .col.hi{opacity:1}
.tn{display:flex;flex-direction:column;gap:1px;line-height:1.25;white-space:nowrap}.tn b{font-size:22px}.tn .kg{font-size:15px;color:var(--muted)}
.sess,.none,.dt,.sn,.u{color:var(--muted)}.sess{font-size:13px}.none{font-size:14px}
.d{font-size:14px;font-weight:600}.d.up{color:var(--up)}.d.down{color:var(--down)}
.dt{font-size:13px;margin-bottom:5px}.sets{display:flex;flex-direction:column;gap:4px}
.set{display:grid;grid-template-columns:48px auto minmax(0,1fr);gap:10px;align-items:baseline;font-size:16px}
.sn{font-size:13px}.rp b{font-size:17px}.rp b.up{color:var(--up)}.rp b.down{color:var(--down)}.u{font-size:14px}.w{color:var(--muted);font-size:15px;text-align:right}
.foot{margin-top:12px;font-size:13px;color:var(--muted)}
@media (max-width:640px){.hd{display:none}.row{grid-template-columns:1fr;gap:12px}.span2{grid-column:auto}}
`;

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
    '</div><p class="foot">Tonnage = reps × weight, added up over every set (kg). For body-weight exercises the weight is added to (or, if negative, taken off) your body weight first. Reps: ' +
    '<b style="color:var(--up)">green</b> above and <b style="color:var(--down)">red</b> below the target range.</p>' +
    '</main></body></html>';
}

export function dayFileName(dayId) {
  const r = dayReport(dayId);
  const slug = (r ? r.name : 'day').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'day';
  return `training-${slug}-${today()}.html`;
}
