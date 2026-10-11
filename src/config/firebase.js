// Single entry point to Firebase: pins the SDK version and holds the project config. Every other
// module imports Firebase from here, so upgrading the SDK is a one-file change.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
export {
  doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyCyLBXgZeYsTW8s7IiGr5foJzLmzo3D9z4',
  authDomain: 'weight-tracking-joan.firebaseapp.com',
  projectId: 'weight-tracking-joan',
  storageBucket: 'weight-tracking-joan.firebasestorage.app',
  messagingSenderId: '452714898066',
  appId: '1:452714898066:web:ecaf9cf5489ad3a6bf3c4b',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
