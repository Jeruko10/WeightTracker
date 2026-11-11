// Hash routes: GitHub Pages has no rewrites, so '#/exercises' is the only deep link that survives a reload.
import { byId, setVisible, playEnter } from '../lib/dom.js';
import { setProfileMenu } from './profile-menu.js';

const ROUTES = {
  bodyweight: { hash: '#/bodyweight', view: 'bodyweight-view', title: 'Weight Tracker', heading: 'Bodyweight' },
  exercises: { hash: '#/exercises', view: 'exercises-view', title: 'Exercises · Weight Tracker', heading: 'Exercises' },
};
const DEFAULT_ROUTE = 'bodyweight';

let current = null;

// A section owns every hash under it ('#/exercises/ex/<id>'); the rest after the section's own
// hash is handed to the section as its sub-route.
function routeFromHash() {
  const h = location.hash;
  const name = Object.keys(ROUTES).find((n) => h === ROUTES[n].hash || h.startsWith(ROUTES[n].hash + '/'));
  return name ? { name, sub: h.slice(ROUTES[name].hash.length + 1) } : { name: DEFAULT_ROUTE, sub: '' };
}

// onEnter(name, sub) runs on every route change, after the layout has switched.
export function initRouter(onEnter) {
  function route() {
    const { name, sub } = routeFromHash();
    if (current && current !== name) playEnter(byId(ROUTES[name].view));
    current = name;
    setProfileMenu(false);
    document.querySelector('.app').dataset.mode = name;
    document.querySelectorAll('.mode-link').forEach((a) => a.classList.toggle('active', a.dataset.mode === name));
    Object.keys(ROUTES).forEach((n) => setVisible(byId(ROUTES[n].view), n === name));
    document.title = ROUTES[name].title;
    byId('top-title').textContent = ROUTES[name].heading;
    onEnter(name, sub);
  }
  window.addEventListener('hashchange', route);
  route();
}
