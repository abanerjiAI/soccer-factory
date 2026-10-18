/** LEVEL 1 — measurement & geometry. Pure functions, metres / seconds. */
import type { Vec } from "./types";

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export function centroid(pts: Vec[]): Vec {
  return { x: mean(pts.map((p) => p.x)), y: mean(pts.map((p) => p.y)) };
}

/** Speeds (m/s) between consecutive samples of a trajectory sampled at times `ts` (s). */
export function speeds(pts: Vec[], ts: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) out.push(dist(pts[i], pts[i - 1]) / (ts[i] - ts[i - 1]));
  return out;
}

/** Acceleration magnitudes (m/s^2) from finite differences of velocity vectors. */
export function accelerations(pts: Vec[], ts: number[]): number[] {
  const vel: { v: Vec; t: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = ts[i] - ts[i - 1];
    vel.push({ v: { x: (pts[i].x - pts[i - 1].x) / dt, y: (pts[i].y - pts[i - 1].y) / dt }, t: (ts[i] + ts[i - 1]) / 2 });
  }
  const out: number[] = [];
  for (let i = 1; i < vel.length; i++) {
    const dt = vel[i].t - vel[i - 1].t;
    out.push(Math.hypot(vel[i].v.x - vel[i - 1].v.x, vel[i].v.y - vel[i - 1].v.y) / dt);
  }
  return out;
}

export function pathLength(pts: Vec[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i], pts[i - 1]);
  return s;
}

/** Nearest-neighbour distance for each point (spacing metric). */
export function nearestNeighbour(pts: Vec[]): number[] {
  return pts.map((p, i) => {
    let m = Infinity;
    pts.forEach((q, j) => {
      if (i !== j) m = Math.min(m, dist(p, q));
    });
    return m;
  });
}

/** RMS distance from the centroid (team spread / compactness), metres. */
export function spread(pts: Vec[]): number {
  if (!pts.length) return 0;
  const c = centroid(pts);
  return Math.sqrt(mean(pts.map((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2)));
}

/** Convex hull area (m^2), Andrew's monotone chain + shoelace. */
export function hullArea(pts: Vec[]): number {
  if (pts.length < 3) return 0;
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Vec[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  let a = 0;
  for (let i = 0; i < h.length; i++) {
    const j = (i + 1) % h.length;
    a += h[i].x * h[j].y - h[j].x * h[i].y;
  }
  return Math.abs(a) / 2;
}

/** 3x3 zone index (0..8, row-major) of a point. */
export function zoneOf(x: number, y: number, W: number, H: number): number {
  const c = Math.min(2, Math.max(0, Math.floor((x / W) * 3)));
  const r = Math.min(2, Math.max(0, Math.floor((y / H) * 3)));
  return r * 3 + c;
}

/**
 * Time (s) to travel distance d starting from rest with acceleration limit a, speed limit v, plus a reaction delay.
 * d <= v^2/(2a): t = sqrt(2d/a);  otherwise t = v/a + (d - v^2/(2a))/v.
 */
export function travelTime(d: number, vmax: number, amax: number, reaction: number): number {
  if (!Number.isFinite(d)) return Infinity;
  if (d <= 0) return reaction;
  const dAcc = (vmax * vmax) / (2 * amax);
  const t = d <= dAcc ? Math.sqrt((2 * d) / amax) : vmax / amax + (d - dAcc) / vmax;
  return reaction + t;
}
