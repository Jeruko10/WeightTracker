export const MAX_SETS = 10;
export const MIN_SETS = 1;
export const MIN_REPS = 1;
export const MAX_REPS = 500;
/** Weight bounds for a logged set. Negative is allowed for assisted lifts. */
export const MAX_ABS_WEIGHT = 1000;
/** History rows shown per set before "Show all". */
export const HISTORY_PREVIEW = 5;
/** Most recent entries per set drawn in an exercise's chart. */
export const CHART_ENTRIES = 10;
/** Most recent entries per set included in the clipboard export. */
export const EXPORT_ENTRIES = 10;
export const DEFAULT_SET = { min: 8, max: 12 };
export const DEFAULT_SET_COUNT = 3;

// One colour per set, used for the set's dot, its chart line and its legend entry. The first
// three are the app's triad; none is red, so no line reads as the "below range" colour.
export const SET_COLORS = ['#5fd4c4', '#c89bf0', '#f2c46d', '#7cb8ff', '#9be7a5', '#f5a97f', '#a0a4ff', '#cde77f', '#7fe3f0', '#dde6ea'];

export const STORAGE_KEYS = {
  mode: 'wt-ex-mode',
  focusDay: 'wt-ex-focus-day',
  open: 'wt-ex-open',
};

// Inline SVG rather than ↑ ✎ ✕ characters, which some platforms swap for coloured emoji.
function icon(d) {
  return `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;
}

export const ICON = {
  up: icon('M8 13V3M4 7l4-4 4 4'),
  down: icon('M8 3v10M4 9l4 4 4-4'),
  edit: icon('M10.5 2.5l3 3L6 13H3v-3z'),
  del: icon('M4 4l8 8M12 4l-8 8'),
  plus: icon('M8 3v10M3 8h10'),
  check: icon('M3 8.5l3 3 7-7'),
  cycle: icon('M13 3v3h-3M12.6 6A5 5 0 0 0 3.2 7M3 13v-3h3M3.4 10a5 5 0 0 0 9.4-1'),
};

export function chevron(extraClass = '') {
  return `<svg class="chev${extraClass}" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>`;
}
