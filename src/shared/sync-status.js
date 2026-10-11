// The small status line under the header: "Loading…", "Saving…", "Saved", errors.
import { byId } from '../lib/dom.js';

const FLASH_MS = 2000;

export function showSync(msg, cls) {
  const el = byId('sync-indicator');
  el.textContent = msg;
  el.className = 'sync-indicator ' + (cls || '');
}

/** Shows a message that clears itself after a moment. */
export function flashSync(msg, cls) {
  showSync(msg, cls);
  setTimeout(() => showSync(''), FLASH_MS);
}

/**
 * Runs a write while reflecting its progress in the status line. Resolves with the task's
 * result; on failure shows the error and re-throws so the caller can react.
 */
export function trackSave(task) {
  showSync('Saving…', 'saving');
  return task().then(
    (result) => {
      flashSync('Saved', 'saved');
      return result;
    },
    (err) => {
      showSync('Error saving. Check your connection', 'error');
      throw err;
    },
  );
}

/** Fire-and-forget version of trackSave: failures are logged, never thrown. */
export function persist(task) {
  return trackSave(task).catch((e) => console.error(e));
}
