// Account details and actions live behind the avatar, so the top of the app stays clean.
// The menu closes on an outside click, Escape, or a section change.
import { byId } from '../lib/dom.js';
import { getThemePref, setThemePref } from '../shared/theme.js';
import { getWeightStep, setWeightStep } from '../shared/settings.js';

let btn = null, menu = null;

export function setProfileMenu(open) {
  menu.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}

function isOpen() {
  return menu.classList.contains('open');
}

/** Fills the menu header and the avatar for the signed-in user. */
export function renderUser(user) {
  byId('user-name').textContent = user.displayName || user.email || '';
  byId('user-email').textContent = user.displayName ? (user.email || '') : '';
  const avatar = byId('user-avatar');
  if (user.photoURL) {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    // Google profile photos can refuse requests that carry another site's referrer.
    img.referrerPolicy = 'no-referrer';
    avatar.replaceChildren(img);
  } else {
    avatar.textContent = (user.displayName || 'U')[0].toUpperCase();
  }
}

function markTheme() {
  const pref = getThemePref();
  document.querySelectorAll('#theme-seg [data-theme-pref]').forEach((b) => {
    const on = b.dataset.themePref === pref;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function markStep() {
  const step = getWeightStep();
  document.querySelectorAll('#step-seg [data-step]').forEach((b) => {
    const on = Number(b.dataset.step) === step;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

export function initProfileMenu() {
  markTheme();
  markStep();
  byId('step-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    setWeightStep(Number(b.dataset.step));
    markStep();
  });
  byId('theme-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-pref]');
    if (!b) return;
    setThemePref(b.dataset.themePref);
    markTheme();
  });
  btn = byId('btn-profile');
  menu = byId('profile-menu');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setProfileMenu(!isOpen());
  });
  document.addEventListener('click', (e) => {
    if (isOpen() && !menu.contains(e.target)) setProfileMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setProfileMenu(false);
      btn.focus();
    }
  });
}
