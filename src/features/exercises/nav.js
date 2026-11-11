// Driven by the URL hash so the browser's Back button and a reload both work.
import { state, closeAllForms } from './state.js';
import { render } from './views/render.js';

let listScroll = 0;

/** Applies a route: `sub` is '', 'archive' or 'ex/<id>'. Closes forms, then reopens a pending one. */
export function applyRoute(sub) {
  const parts = (sub || '').split('/');
  const wasList = state.view.kind === 'list';
  if (parts[0] === 'archive') state.view = { kind: 'archive', id: null };
  else if (parts[0] === 'ex' && parts[1]) state.view = { kind: 'ex', id: parts[1] };
  else state.view = { kind: 'list', id: null };

  const form = state.pendingForm;
  state.pendingForm = null;
  closeAllForms();
  if (form) state.ui[form.slot] = form.id;
  if (wasList && state.view.kind !== 'list') listScroll = window.scrollY;
  render();
  window.scrollTo(0, state.view.kind === 'list' ? listScroll : 0);
}

// Setting the hash fires the router (→ applyRoute); if it already matches nothing fires, so apply directly.
export function goTo(sub, form) {
  state.pendingForm = form || null;
  const target = '#/exercises' + (sub ? '/' + sub : '');
  if (location.hash === target) applyRoute(sub);
  else location.hash = target;
}

export const exRoute = (id) => 'ex/' + id;
