// Plain-text helpers for the clipboard export. Columns are padded so they line up in any
// monospaced viewer.

/** A line of '=' at least 24 wide, or as wide as the title it frames. */
export function rule(width) {
  return '='.repeat(Math.max(width, 24));
}

/** A framed section title: rule, title, rule, blank line. */
export function heading(title) {
  const r = rule(title.length);
  return [r, title, r, ''];
}

export function padRight(s, n) {
  return String(s).padEnd(n);
}

export function padLeft(s, n) {
  return String(s).padStart(n);
}
