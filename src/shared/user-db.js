// Every document the app stores lives under users/{uid}/. These helpers build references for
// the signed-in user, so features never handle the uid themselves.
import { db, doc, collection } from '../config/firebase.js';

let uid = null;

export function setCurrentUser(id) {
  uid = id;
}

/** userDoc('entries', id) → users/{uid}/entries/{id} */
export function userDoc(...path) {
  return doc(db, 'users', uid, ...path);
}

export function userCol(name) {
  return collection(db, 'users', uid, name);
}

/** A fresh document id, generated locally so the UI can use it before the write lands. */
export function newDocId(name) {
  return doc(userCol(name)).id;
}
