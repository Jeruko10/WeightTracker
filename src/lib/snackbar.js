// A small toast with an optional action ("Undo"). One at a time: a new one replaces the current.
// Announced politely to screen readers; stays long enough to be read and reached.
import { byId } from './dom.js';

const SHOW_MS = 7000;
let timer = null;

function bar() {
  let el = byId('snackbar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snackbar';
    el.className = 'snackbar';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function hideSnackbar() {
  clearTimeout(timer);
  bar().classList.remove('show');
}

/** `action`: { label, run } — shown as a button; tapping it runs `run` and closes the bar. */
export function showSnackbar(message, action) {
  const el = bar();
  el.textContent = '';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      hideSnackbar();
      action.run();
    });
    el.appendChild(btn);
  }
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(hideSnackbar, SHOW_MS);
}
