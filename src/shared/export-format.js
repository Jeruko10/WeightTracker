/** A line of '=' at least 24 wide, or as wide as the title it frames. */
export function rule(width) {
  return '='.repeat(Math.max(width, 24));
}

/** A framed section title: rule, title, rule, blank line. */
export function heading(title) {
  const r = rule(title.length);
  return [r, title, r, ''];
}

/**
 * A logged weight as a person reads it. Plain exercises: "62.5 kg". Body-weight exercises: the
 * number entered is added to (or, if negative, taken off) the user's body weight, so say so:
 * "bodyweight + 30 kg", "bodyweight − 10 kg", or just "bodyweight" for 0.
 */
export function weightLabel(weight, bodyweight) {
  const w = Math.round(weight * 100) / 100;
  if (!bodyweight) return w + ' kg';
  if (w === 0) return 'bodyweight';
  return 'bodyweight ' + (w > 0 ? '+' : '−') + ' ' + Math.abs(w) + ' kg';
}

export function padRight(s, n) {
  return String(s).padEnd(n);
}

export function padLeft(s, n) {
  return String(s).padStart(n);
}
