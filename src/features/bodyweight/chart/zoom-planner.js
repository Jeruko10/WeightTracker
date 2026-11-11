// Plans y per edge before the zoom (concave majorant when widening, convex minorant when narrowing): driving y off live data lurches.

const SAMPLES = 48;
// Keeps the fitted path clear of the requirement between samples. Without it the path can fall
// a hair short for a single frame, the last-resort union takes over for exactly that frame, and
// the scale twitches.
const MARGIN = 0.04;
const EPS = 1e-9;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// How far along from→to the scale must already be for `v` to be inside it.
function progressFor(from, to, v, isMin) {
  const d = to - from;
  if (isMin) return d >= -EPS ? 0 : clamp01((from - v) / (from - to));
  return d <= EPS ? 0 : clamp01((v - from) / d);
}

// Hull boundary through a set of samples: the smallest concave function above them all
// (upper=true), or the largest convex function below them all (upper=false).
function hullOf(pts, upper) {
  const h = [];
  for (const c of pts) {
    while (h.length >= 2) {
      const a = h[h.length - 2], b = h[h.length - 1];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (upper ? cross >= 0 : cross <= 0) h.pop();
      else break;
    }
    h.push(c);
  }
  return h;
}

// Evaluates the hull as a rounded curve rather than a polygon. Straight segments meeting at a
// corner change speed instantly, which at this duration reads as a stutter; blending each
// vertex's two slopes gives a path with no corners at all. The rounding only ever cuts inside
// the polygon, which the margin baked into the samples already covers.
function evalHull(h, x) {
  const n = h.length;
  if (n === 1) return h[0].y;
  let i = 1;
  while (i < n - 1 && x > h[i].x) i++;
  const a = h[i - 1], b = h[i], dx = b.x - a.x;
  if (dx <= 0) return b.y;
  const t = clamp01((x - a.x) / dx);
  const m = (b.y - a.y) / dx;
  // Neighbouring slopes, skipped when the neighbour sits at the same x — dividing by that zero
  // width would poison the tangent, and with it the whole scale, with NaN.
  let mPrev = m, mNext = m;
  if (i >= 2 && a.x !== h[i - 2].x) mPrev = (a.y - h[i - 2].y) / (a.x - h[i - 2].x);
  if (i <= n - 2 && h[i + 1].x !== b.x) mNext = (h[i + 1].y - b.y) / (h[i + 1].x - b.x);
  const ta = (mPrev + m) / 2, tb = (m + mNext) / 2;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a.y + (t3 - 2 * t2 + t) * dx * ta + (-2 * t3 + 3 * t2) * b.y + (t3 - t2) * dx * tb;
}

function planEdge(reqs, from, to, isMin) {
  const N = reqs.length - 1, pts = [];
  const widening = isMin ? to < from - EPS : to > from + EPS;
  const narrowing = isMin ? to > from + EPS : to < from - EPS;
  if (!widening && !narrowing) return null; // edge does not move
  const edgeOf = (r) => (isMin ? r.min : r.max);

  if (widening) {
    let run = 0;
    for (let i = 0; i <= N; i++) {
      let need = reqs[i] ? progressFor(from, to, edgeOf(reqs[i]), isMin) : 0;
      need = Math.min(1, need + MARGIN);
      if (i === N) need = 1;
      if (need > run) run = need;
      pts.push({ x: i / N, y: i === 0 ? 0 : run }); // the path always starts from the scale on screen
    }
    return hullOf(pts, true);
  }

  // Narrowing: allow[i] is the furthest along the edge may be at sample i. An increasing path
  // can only ever sit under the smallest allowance still ahead of it.
  const allow = [];
  for (let i = 0; i <= N; i++) {
    const v = reqs[i] ? edgeOf(reqs[i]) : null;
    const t = v === null ? 1 : clamp01(isMin ? (v - from) / (to - from) : (from - v) / (from - to));
    allow.push(i === N ? 1 : Math.max(0, t - MARGIN));
  }
  for (let i = N - 1; i >= 0; i--) if (allow[i + 1] < allow[i]) allow[i] = allow[i + 1];
  allow[0] = 0; // the path always starts from the scale on screen
  for (let i = 0; i <= N; i++) pts.push({ x: i / N, y: allow[i] });
  return hullOf(pts, false);
}

export function planZoomY(fromV, toV, yFrom, yTo, boundsAt) {
  if (!yFrom || !yTo) return null;
  const reqs = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const e = i / SAMPLES;
    reqs.push(boundsAt(fromV.min + (toV.min - fromV.min) * e, fromV.max + (toV.max - fromV.max) * e));
  }
  return {
    min: planEdge(reqs, yFrom.min, yTo.min, true),
    max: planEdge(reqs, yFrom.max, yTo.max, false),
  };
}

// One frame's vertical scale, from the plan. The union with the live bounds stays as a
// last-resort guarantee; with the plan in place it should never actually bite.
export function zoomYBounds(minX, maxX, e, yFrom, yTo, plan, boundsAt) {
  if (!yFrom || !yTo) return yTo || yFrom || null;
  const gMin = plan && plan.min ? evalHull(plan.min, e) : e;
  const gMax = plan && plan.max ? evalHull(plan.max, e) : e;
  const yb = { min: yFrom.min + (yTo.min - yFrom.min) * gMin, max: yFrom.max + (yTo.max - yFrom.max) * gMax };
  const actual = boundsAt(minX, maxX);
  if (actual) {
    if (actual.min < yb.min) yb.min = actual.min;
    if (actual.max > yb.max) yb.max = actual.max;
  }
  return yb;
}
