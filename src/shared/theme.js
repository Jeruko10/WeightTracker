// Theme: System / Light / Dark. The palette itself lives in styles/tokens.css; this module picks
// which one applies (a data-theme attribute on <html>) and exposes the same colours to JS, since
// Chart.js draws on a canvas and can't read CSS variables by itself.
import { loadPref, savePref } from '../lib/storage.js';

const KEY = 'wt-theme';
const PREFS = ['system', 'light', 'dark'];

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Read at use time, so a chart drawn after a theme change picks up the new colours.
export const COLORS = {
  get accent() { return css('--accent'); },
  get accentFill() { return css('--accent-fill'); },
  get accentBand() { return css('--accent-band'); },
  get accentMuted() { return css('--accent-muted'); },
  get amber() { return css('--warn'); },
};

export const CHART_THEME = {
  get grid() { return 'rgba(' + css('--chart-grid-rgb') + ',' + css('--chart-grid-alpha') + ')'; },
  get gridRgb() { return css('--chart-grid-rgb'); },
  get gridAlpha() { return Number(css('--chart-grid-alpha')); },
  get tick() { return css('--chart-tick'); },
  get tickRgb() { return css('--chart-tick-rgb'); },
  fontSize: 11,
};

export function getThemePref() {
  const p = loadPref(KEY, 'system');
  return PREFS.includes(p) ? p : 'system';
}

/** Applies a preference and tells the app (charts must be redrawn) with a 'themechange' event. */
export function setThemePref(pref) {
  const p = PREFS.includes(pref) ? pref : 'system';
  savePref(KEY, p === 'system' ? null : p);
  applyTheme();
  window.dispatchEvent(new Event('themechange'));
}

/** Sets data-theme from the saved preference ("system" leaves it to the OS) and the browser UI colour. */
export function applyTheme() {
  const p = getThemePref(), root = document.documentElement;
  if (p === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = p;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = css('--bg');
}

/** Call once at startup: applies the preference and follows the OS while it is "System". */
export function initTheme() {
  applyTheme();
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', () => {
      if (getThemePref() !== 'system') return;
      applyTheme();
      window.dispatchEvent(new Event('themechange'));
    });
  }
}
