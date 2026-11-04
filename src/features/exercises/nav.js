// Which screen of Exercises is showing: the list, one exercise's detail, or the archive. It is
// driven by the URL hash (#/exercises, #/exercises/ex/<id>, #/exercises/archive) so the browser's
// Back button and a reload both work; the shell passes the part after '#/exercises/' in here.
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

/**
 * Navigates to a route. `form` ({ slot, id }) is opened once the route is applied. Setting the
 * hash fires the router, which calls applyRoute; when the hash already matches nothing would
 * fire, so apply directly.
 */
export function goTo(sub, form) {
  state.pendingForm = form || null;
  const target = '#/exercises' + (sub ? '/' + sub : '');
  if (location.hash === target) applyRoute(sub);
  else location.hash = target;
}

export const exRoute = (id) => 'ex/' + id;
