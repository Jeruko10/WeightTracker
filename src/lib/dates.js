// Date keys are plain calendar days ('YYYY-MM-DD'), which JS parses as UTC midnight. All day
// arithmetic here therefore stays in UTC — mixing in local getters/setters silently loses or
// repeats a day when the clock crosses a daylight-saving boundary.

export const DAY_MS = 864e5;
export const WEEK_MS = 7 * DAY_MS;

/** Today's calendar day in the user's own timezone. */
export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

export function addDays(day, n) {
  const dt = new Date(day);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((new Date(to) - new Date(from)) / DAY_MS);
}

/** 'YYYY-Www' bucket used by the weekly summary. */
export function weekKey(day) {
  const dt = new Date(day), jan = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt - jan) / DAY_MS + jan.getUTCDay() + 1) / 7);
  return dt.getUTCFullYear() + '-W' + (wk < 10 ? '0' : '') + wk;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY', or '-' when there is no date. */
export function formatDate(day) {
  if (!day) return '-';
  const [y, m, d] = day.split('-');
  return d + '/' + m + '/' + y;
}

/** 'YYYY-MM-DD' → 'DD/MM/YY'. */
export function formatDateShort(day) {
  const [y, m, d] = day.split('-');
  return d + '/' + m + '/' + y.slice(2);
}

/** 'YYYY-MM-DD' → 'DD/MM'. Used for chart axis labels. */
export function formatDayMonth(day) {
  const [, m, d] = day.split('-');
  return d + '/' + m;
}

/** A local Date object → 'DD/MM/YYYY'. */
export function formatLocalDate(date) {
  const d = date.getDate(), m = date.getMonth() + 1;
  return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m + '/' + date.getFullYear();
}
