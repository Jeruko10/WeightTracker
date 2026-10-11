// Entry point: wires the shell (auth, profile menu, router, export) to the feature sections.
import { initAuth } from './shell/auth.js';
import { initProfileMenu, renderUser } from './shell/profile-menu.js';
import { initRouter } from './shell/router.js';
import { initExport } from './shell/export.js';
import {
  initBodyweight, loadBodyweight, clearBodyweight, onBodyweightShown,
} from './features/bodyweight/index.js';
import {
  initExercises, loadExercises, clearExercises, resetExercisesMode,
} from './features/exercises/index.js';

initProfileMenu();
initExport();
initBodyweight();
initExercises();

initRouter((section) => {
  if (section !== 'bodyweight') return;
  // Opening Bodyweight resets Exercises to read-only View, so arriving there never lands in
  // Edit or mid-Train.
  resetExercisesMode();
  onBodyweightShown();
});

initAuth({
  onSignIn(user) {
    renderUser(user);
    loadBodyweight();
    loadExercises(user.uid);
  },
  onSignOut() {
    clearBodyweight();
    clearExercises();
  },
});
