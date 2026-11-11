import { byId } from '../lib/dom.js';
import { showSync } from '../shared/sync-status.js';
import { today, formatDate } from '../lib/dates.js';
import { copyText } from '../lib/clipboard.js';
import { buildHtmlReport, reportFileName } from './export-html.js';
import { buildDayHtml, dayFileName } from './export-day.js';
import { heading } from '../shared/export-format.js';
import { exportSections } from '../features/exercises/index.js';
import { exportBodyweight } from '../features/bodyweight/index.js';

const FEEDBACK_MS = 2000;
const TEXT_LABEL = 'Copy as text';
const HTML_LABEL = 'Export HTML report';
let feedbackTimer = null;

export function buildExport() {
  const ex = exportSections();
  let out = [
    'TRAINING LOG',
    'Exported ' + formatDate(today()),
    'Last ' + ex.entries + ' entries per set, newest first. ↑ above target range, ↓ below.',
    '',
  ];
  out = out.concat(ex.training, [''], heading('DELOAD'), ex.deload);
  const bodyweight = exportBodyweight();
  if (bodyweight) out = out.concat([''], heading('BODYWEIGHT'), bodyweight);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function saveHtml(html, fileName) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportDay(id) {
  const html = buildDayHtml(id);
  if (!html) return;
  saveHtml(html, dayFileName(id));
  showSync('Day exported', 'saved');
  setTimeout(() => showSync(''), FEEDBACK_MS);
}

function downloadHtmlReport(btn) {
  try {
    saveHtml(buildHtmlReport(), reportFileName());
    btn.textContent = 'Report downloaded!';
    btn.classList.add('done');
  } catch (e) {
    console.error(e);
    btn.textContent = 'Couldn\'t build the report';
  }
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    btn.textContent = HTML_LABEL;
    btn.classList.remove('done');
  }, FEEDBACK_MS);
}

export function initExport() {
  // The list is re-rendered constantly, so listen on its container rather than on the buttons.
  byId('ex-tree').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action=day-export]');
    if (b && !b.disabled) exportDay(b.dataset.id);
  });
  const htmlBtn = byId('btn-export-html');
  htmlBtn.addEventListener('click', () => downloadHtmlReport(htmlBtn));
  const btn = byId('btn-export');
  btn.addEventListener('click', () => {
    copyText(buildExport())
      .then(() => {
        btn.textContent = 'Copied to clipboard!';
        btn.classList.add('done');
      }, (e) => {
        console.error(e);
        btn.textContent = 'Couldn\'t copy';
      })
      .then(() => {
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          btn.textContent = TEXT_LABEL;
          btn.classList.remove('done');
        }, FEEDBACK_MS);
      });
  });
}
