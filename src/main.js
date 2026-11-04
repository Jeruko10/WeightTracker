// Entry point: wires the shell (auth, profile menu, router, export) to the feature sections.
import { initAuth } from './shell/auth.js';
import { initProfileMenu, renderUser } from './shell/profile-menu.js';
import { initRouter } from './shell/router.js';
import { initExport } from './shell/export.js';
import {
  initBodyweight, loadBodyweight, clearBodyweight, onBodyweightShown, makeBodyweightLookup,
} from './features/bodyweight/index.js';
import {
  initExercises, loadExercises, clearExercises, resetExercisesMode, setBodyweightProvider,
  applyExercisesRoute, refreshExercises,
} from './features/exercises/index.js';

// Features can't import each other: bodyweight exercises get their 7-day average through here.
setBodyweightProvider(makeBodyweightLookup);

initProfileMenu();
initExport();
initBodyweight();
initExercises();

initRouter((section, sub) => {
  if (section === 'exercises') {
    applyExercisesRoute(sub);
    return;
  }
  // Opening Bodyweight resets Exercises to read-only View, so arriving there never lands in
  // Edit or mid-Train.
  resetExercisesMode();
  onBodyweightShown();
});

initAuth({
  onSignIn(user) {
    renderUser(user);
    // Tonnage of body weight exercises uses the weigh-ins, so redraw once they have arrived.
    loadBodyweight().then(refreshExercises);
    loadExercises(user.uid);
  },
  onSignOut() {
    clearBodyweight();
    clearExercises();
  },
});
