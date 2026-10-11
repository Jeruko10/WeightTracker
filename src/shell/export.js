// One plain-text snapshot of everything, copied to the clipboard from the profile menu: the
// training log first, then the deload cycle, then bodyweight (only when there is any).
import { byId } from '../lib/dom.js';
import { today, formatDate } from '../lib/dates.js';
import { copyText } from '../lib/clipboard.js';
import { heading } from '../shared/export-format.js';
import { exportSections } from '../features/exercises/index.js';
import { exportBodyweight } from '../features/bodyweight/index.js';

const FEEDBACK_MS = 2000;
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

export function initExport() {
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
          btn.textContent = 'Export';
          btn.classList.remove('done');
        }, FEEDBACK_MS);
      });
  });
}
