export function byId(id) {
  return document.getElementById(id);
}

/** Shows or hides an element by clearing or setting an inline `display:none`. */
export function setVisible(el, visible) {
  el.style.display = visible ? '' : 'none';
}

// Re-plays a short fade-in on a block that was just swapped in, so section, tab and mode
// changes don't jump abruptly. The forced reflow restarts the animation on repeat calls.
export function playEnter(el) {
  el.classList.remove('view-enter');
  void el.offsetWidth;
  el.classList.add('view-enter');
}
