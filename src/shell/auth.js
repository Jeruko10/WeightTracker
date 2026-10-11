// Google sign-in/out and the switch between the login screen and the app.
import { auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setDoc } from '../config/firebase.js';
import { byId } from '../lib/dom.js';
import { confirmTap } from '../lib/confirm-tap.js';
import { setCurrentUser, userDoc } from '../shared/user-db.js';
import { setProfileMenu } from './profile-menu.js';

function saveProfile(user) {
  setDoc(userDoc('data', 'profile'), { name: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '' });
}

/** `onSignIn(user)` / `onSignOut()` run after the user scope and the screens are switched. */
export function initAuth({ onSignIn, onSignOut }) {
  byId('btn-google-sign-in').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(console.error);
  });
  // Same "tap again to confirm" pattern as the deletes, so a stray tap never logs you out.
  byId('btn-signout').addEventListener('click', (e) => {
    if (!confirmTap(e.currentTarget, 'Tap again to sign out')) return;
    setProfileMenu(false);
    signOut(auth);
  });

  onAuthStateChanged(auth, (user) => {
    setCurrentUser(user ? user.uid : null);
    byId('login-screen').style.display = user ? 'none' : 'flex';
    byId('app-screen').style.display = user ? '' : 'none';
    if (user) {
      saveProfile(user);
      onSignIn(user);
    } else {
      onSignOut();
    }
  });
}
