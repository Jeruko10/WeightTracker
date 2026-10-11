// Overview / Log / Goal tabs inside the Bodyweight section.
import { byId, playEnter } from '../../../lib/dom.js';
import { renderGoalTab } from './goal-tab.js';

function selectTab(tab) {
  const name = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  const section = byId(name);
  section.classList.add('active');
  playEnter(section);
  if (name === 'goal') renderGoalTab();
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab));
  });
}
