const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for safe interpolation into HTML strings and attribute values. */
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** The word to use next to a count: plural(1, 'set') → 'set', plural(2, 'set') → 'sets'. */
export function plural(n, one, many = one + 's') {
  return n === 1 ? one : many;
}
