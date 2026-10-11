// Firestore access for Bodyweight. Layout, all under users/{uid}/:
//   entries/{id}       { date, weight }
//   data/goal          the active goal
//   goalHistory/{id}   archived goals
import { getDoc, getDocs, setDoc, addDoc, deleteDoc } from '../../config/firebase.js';
import { userDoc, userCol } from '../../shared/user-db.js';
import { trackSave } from '../../shared/sync-status.js';

const GOAL_PATH = ['data', 'goal'];

function rows(snap) {
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
}

export async function fetchAll() {
  const [entrySnap, goalSnap, historySnap] = await Promise.all([
    getDocs(userCol('entries')),
    getDoc(userDoc(...GOAL_PATH)),
    getDocs(userCol('goalHistory')),
  ]);
  return {
    entries: rows(entrySnap).sort((a, b) => a.date.localeCompare(b.date)),
    goal: goalSnap.exists() ? goalSnap.data() : null,
    goalHistory: rows(historySnap).sort((a, b) => (b.savedOn || '').localeCompare(a.savedOn || '')),
  };
}

export async function createEntry(entry) {
  const ref = await trackSave(() => addDoc(userCol('entries'), { date: entry.date, weight: entry.weight }));
  entry._id = ref.id;
}

export function updateEntry(entry) {
  return trackSave(() => setDoc(userDoc('entries', entry._id), { date: entry.date, weight: entry.weight }));
}

export function deleteEntry(entry) {
  return trackSave(() => deleteDoc(userDoc('entries', entry._id)));
}

export function saveGoal(goal) {
  return trackSave(() => setDoc(userDoc(...GOAL_PATH), goal));
}

export function deleteGoal() {
  return deleteDoc(userDoc(...GOAL_PATH));
}

export async function createGoalHistory(archived) {
  const ref = await trackSave(() => addDoc(userCol('goalHistory'), archived));
  archived._id = ref.id;
}

export function deleteGoalHistory(archived) {
  return deleteDoc(userDoc('goalHistory', archived._id));
}
