const CONFIRM_WINDOW_MS = 3000;
const armed = new WeakMap(); // button → { html, timer }

/** Returns true when this tap confirms; false when it only armed the button. */
export function confirmTap(btn, label = 'Confirm') {
  if (armed.has(btn)) {
    disarm(btn);
    return true;
  }
  armed.set(btn, { html: btn.innerHTML, timer: setTimeout(() => disarm(btn), CONFIRM_WINDOW_MS) });
  btn.classList.add('confirming');
  btn.textContent = label;
  return false;
}

function disarm(btn) {
  const state = armed.get(btn);
  if (!state) return;
  clearTimeout(state.timer);
  armed.delete(btn);
  btn.classList.remove('confirming');
  btn.innerHTML = state.html;
}
