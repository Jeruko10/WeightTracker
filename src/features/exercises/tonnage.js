import { logSides, setLogs } from './selectors.js';

// bw is added to the lifted weight of every side (bodyweight exercises).
export function logTonnage(l, bw = 0) {
  return logSides(l).reduce((t, s) => t + s.reps * (s.weight + bw), 0);
}

// Oldest first; bwAt(date) null counts as 0.
export function dailyTonnage(x, track, bwAt) {
  const byDate = new Map();
  x.sets.forEach((s, k) => {
    setLogs(x.id, s.id, track).forEach((l) => {
      const bw = x.bodyweight && bwAt ? bwAt(l.date) || 0 : 0;
      const t = logTonnage(l, bw);
      const day = byDate.get(l.date) || { date: l.date, total: 0, parts: [] };
      day.total += t;
      day.parts.push({ set: k, tonnage: t });
      byDate.set(l.date, day);
    });
  });
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function tonnageSeries(x, track, bwLookup) {
  const days = dailyTonnage(x, track, bwLookup);
  const last = days[days.length - 1], prev = days[days.length - 2];
  return {
    days,
    last: last || null,
    change: last && prev && prev.total ? ((last.total - prev.total) / prev.total) * 100 : null,
    bodyweightMissing: !!x.bodyweight && !bwLookup.firstDate,
    estimated: !!x.bodyweight && !!bwLookup.firstDate && days.some((d) => d.date < bwLookup.firstDate),
  };
}
