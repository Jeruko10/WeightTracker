// Firestore access for Exercises. Layout, all under users/{uid}/:
//   trainingDays/{id}  { name, order, createdAt }
//   exercises/{id}     { dayId, name, order, sets: [{ id, min, max }] }
//   exerciseLogs/{id}  { exerciseId, setId, date, reps, weight, createdAt }
//   deloads/{id}       { date, createdAt }   (each doc marks the day a deload starts)
// Sets carry their own stable id so a log stays attached to the right set when sets are added,
// removed or reordered — an index would silently shift history onto another set.
//
// Writes are optimistic: callers update state and re-render first, then persist here.
import { getDocs, setDoc, updateDoc, deleteDoc, writeBatch, db } from '../../config/firebase.js';
import { userDoc, userCol, newDocId } from '../../shared/user-db.js';
import { persist } from '../../shared/sync-status.js';

export const COLLECTIONS = {
  days: 'trainingDays',
  exercises: 'exercises',
  logs: 'exerciseLogs',
  deloads: 'deloads',
};

// A batch holds at most 500 writes, so long cascades are split across several.
const BATCH_SIZE = 450;

export function newId(collection) {
  return newDocId(collection);
}

export async function fetchAll() {
  const names = [COLLECTIONS.days, COLLECTIONS.exercises, COLLECTIONS.logs, COLLECTIONS.deloads];
  const snaps = await Promise.all(names.map((n) => getDocs(userCol(n))));
  const [days, exercises, logs, deloads] = snaps.map((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  return { days, exercises, logs, deloads };
}

// ── Serializers: only these fields are stored ─────────────────────────────────
const dayData = (d) => ({ name: d.name, order: d.order, createdAt: d.createdAt });
const exerciseData = (x) => ({
  dayId: x.dayId, name: x.name, order: x.order,
  sets: x.sets.map((s) => ({ id: s.id, min: s.min, max: s.max })),
});
const logData = (l) => ({
  exerciseId: l.exerciseId, setId: l.setId, date: l.date, reps: l.reps, weight: l.weight, createdAt: l.createdAt,
});

// ── Batches ───────────────────────────────────────────────────────────────────
// Cascading deletes and reorders are written as batches so they land all-or-nothing.
const del = (collection, id) => ({ type: 'delete', ref: userDoc(collection, id) });

function runBatch(ops) {
  if (!ops.length) return Promise.resolve();
  return persist(async () => {
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      ops.slice(i, i + BATCH_SIZE).forEach((o) => {
        if (o.type === 'delete') batch.delete(o.ref);
        else if (o.type === 'update') batch.update(o.ref, o.data);
        else batch.set(o.ref, o.data);
      });
      await batch.commit();
    }
  });
}

// ── Training days ─────────────────────────────────────────────────────────────
export const saveDay = (d) => persist(() => setDoc(userDoc(COLLECTIONS.days, d.id), dayData(d)));
export const renameDay = (id, name) => persist(() => updateDoc(userDoc(COLLECTIONS.days, id), { name }));

/** Deletes a day together with its exercises and their logs. */
export function deleteDayCascade(dayId, exercises, logs) {
  return runBatch([del(COLLECTIONS.days, dayId)]
    .concat(exercises.map((x) => del(COLLECTIONS.exercises, x.id)))
    .concat(logs.map((l) => del(COLLECTIONS.logs, l.id))));
}

/** Writes the `order` of every item whose position changed. */
export function saveOrder(collection, items) {
  return runBatch(items.map((o) => ({ type: 'update', ref: userDoc(collection, o.id), data: { order: o.order } })));
}

// ── Exercises ─────────────────────────────────────────────────────────────────
export const saveExercise = (x) => persist(() => setDoc(userDoc(COLLECTIONS.exercises, x.id), exerciseData(x)));

/** Saves an edited exercise and deletes the logs of any sets it no longer has. */
export function saveExerciseDroppingLogs(x, droppedLogs) {
  return runBatch([{ type: 'set', ref: userDoc(COLLECTIONS.exercises, x.id), data: exerciseData(x) }]
    .concat(droppedLogs.map((l) => del(COLLECTIONS.logs, l.id))));
}

export function deleteExerciseCascade(exId, logs) {
  return runBatch([del(COLLECTIONS.exercises, exId)].concat(logs.map((l) => del(COLLECTIONS.logs, l.id))));
}

// ── Logs ──────────────────────────────────────────────────────────────────────
export const saveLog = (l) => persist(() => setDoc(userDoc(COLLECTIONS.logs, l.id), logData(l)));
export const deleteLog = (id) => persist(() => deleteDoc(userDoc(COLLECTIONS.logs, id)));

// ── Deloads ───────────────────────────────────────────────────────────────────
export const saveDeload = (d) => persist(() => setDoc(userDoc(COLLECTIONS.deloads, d.id), { date: d.date, createdAt: d.createdAt }));
export const updateDeloadDate = (id, date) => persist(() => updateDoc(userDoc(COLLECTIONS.deloads, id), { date }));
export const deleteDeload = (id) => persist(() => deleteDoc(userDoc(COLLECTIONS.deloads, id)));
