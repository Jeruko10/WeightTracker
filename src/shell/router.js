// Switches between the app's sections. Hash routes rather than paths: the site is served as
// static files from GitHub Pages, which has no rewrites, so '#/exercises' is the only kind of
// deep link that survives a reload.
import { byId, setVisible, playEnter } from '../lib/dom.js';
import { setProfileMenu } from './profile-menu.js';

const ROUTES = {
  bodyweight: { hash: '#/bodyweight', view: 'bodyweight-view', title: 'Weight Tracker' },
  exercises: { hash: '#/exercises', view: 'exercises-view', title: 'Exercises · Weight Tracker' },
};
const DEFAULT_ROUTE = 'bodyweight';

let current = null;

function routeFromHash() {
  return Object.keys(ROUTES).find((name) => ROUTES[name].hash === location.hash) || DEFAULT_ROUTE;
}

/** `onEnter(name)` runs every time a section is shown, after the layout has switched. */
export function initRouter(onEnter) {
  function route() {
    const name = routeFromHash();
    if (current && current !== name) playEnter(byId(ROUTES[name].view));
    current = name;
    setProfileMenu(false);
    document.querySelector('.app').dataset.mode = name;
    document.querySelectorAll('.mode-link').forEach((a) => a.classList.toggle('active', a.dataset.mode === name));
    Object.keys(ROUTES).forEach((n) => setVisible(byId(ROUTES[n].view), n === name));
    document.title = ROUTES[name].title;
    onEnter(name);
  }
  window.addEventListener('hashchange', route);
  route();
}
