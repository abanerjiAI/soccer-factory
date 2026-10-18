/**
 * START-HERE MODEL (rungs 1-2: "Reach" and "Importance").
 * The simplest honest version of coverage, small enough to derive on paper:
 *
 *   reach radius R = speed x seconds                         (straight-line, no acceleration)
 *   a spot is REACHED when its (walking) distance to the nearest agent is <= R
 *   coverage = reached area / total area                     (every spot counts equally)
 *   weighted coverage = sum(w_c over reached cells) / sum(w_c) (important spots count more)
 *
 * Soccer: distance is a straight line.
 * Factory: distance is the WALKING path around racks (8-neighbour Dijkstra on a 1 m grid), so a rack between you and a
 * station really does make it farther. That is the only difference in the maths; the rest is shared.
 *
 * Pure TypeScript, no UI imports. Importance weights reuse the Environment definition (own goal + ball for soccer,
 * stations for a factory) so this page and the full Lab describe the same world.
 */
import type { Environment, Vec } from "./types";

export interface IntroInput {
  env: Environment;
  agents: Vec[];
  /** where the ball / active job is (soccer only; ignored in factory) */
  focus: Vec;
  /** m/s, constant (acceleration is added in the Lab) */
  speed: number;
  /** seconds available to arrive */
  seconds: number;
  /** count important spots more? */
  weighted: boolean;
}

export interface IntroResult {
  nx: number;
  ny: number;
  cs: number;
  /** 1 = spot reached in time, 0 = not reached, 2 = blocked (rack) */
  state: Uint8Array;
  weight: Float32Array;
  radius: number;
  coverage: number;
  weightedCoverage: number;
  /** mean walking/running distance from a free spot to its nearest agent, metres */
  meanDistance: number;
  worst: { x: number; y: number; d: number } | null;
  stations: { id: string; x: number; y: number; weight: number; critical: boolean; distance: number; reached: boolean; nearestAgent: number }[];
  /** factory only: metres a unit walks along the whole flow route (null in soccer) */
  flowDistance: number | null;
  /** index of the agent that is nearest to the most important unreached spot (for hints), or -1 */
  busiest: number;
}

export const reachRadius = (speed: number, seconds: number) => Math.max(0, speed * seconds);

/** Binary-heap Dijkstra on a grid. Returns distances (m) from a source cell; Infinity for blocked/unreachable cells. */
export function gridDistances(nx: number, ny: number, cs: number, blocked: Uint8Array, sx: number, sy: number): Float64Array {
  const n = nx * ny;
  const dist = new Float64Array(n).fill(Infinity);
  const clampI = (v: number, hi: number) => Math.min(hi, Math.max(0, v));
  let s = clampI(sx, nx - 1) + clampI(sy, ny - 1) * nx;
  if (blocked[s]) {
    // start inside a rack: use the nearest free cell
    let best = -1, bd = Infinity;
    for (let c = 0; c < n; c++) {
      if (blocked[c]) continue;
      const d = (c % nx - sx) ** 2 + (Math.floor(c / nx) - sy) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (best < 0) return dist;
    s = best;
  }
  const heapK: number[] = [], heapV: number[] = [];
  const push = (k: number, v: number) => {
    let i = heapK.length;
    heapK.push(k); heapV.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapK[p] <= heapK[i]) break;
      [heapK[p], heapK[i]] = [heapK[i], heapK[p]];
      [heapV[p], heapV[i]] = [heapV[i], heapV[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const k = heapK[0], v = heapV[0];
    const lk = heapK.pop()!, lv = heapV.pop()!;
    if (heapK.length) {
      heapK[0] = lk; heapV[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heapK.length && heapK[l] < heapK[m]) m = l;
        if (r < heapK.length && heapK[r] < heapK[m]) m = r;
        if (m === i) break;
        [heapK[m], heapK[i]] = [heapK[i], heapK[m]];
        [heapV[m], heapV[i]] = [heapV[i], heapV[m]];
        i = m;
      }
    }
    return [k, v];
  };
  dist[s] = 0;
  push(0, s);
  const D = Math.SQRT2 * cs;
  while (heapK.length) {
    const [d, c] = pop();
    if (d > dist[c]) continue;
    const cx = c % nx, cy = (c / nx) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
        const q = x + y * nx;
        if (blocked[q]) continue;
        // no cutting corners through the edge of a rack
        if (dx && dy && (blocked[cx + dx + cy * nx] || blocked[cx + (cy + dy) * nx])) continue;
        const nd = d + (dx && dy ? D : cs);
        if (nd < dist[q]) { dist[q] = nd; push(nd, q); }
      }
    }
  }
  return dist;
}

const flowCache = new Map<string, number>();

export function introGridFor(env: Environment) {
  // soccer: 2.5 m cells (42x27); factory: 1 m cells (60x40) so racks are resolved
  const cs = env.mode === "soccer" ? 2.5 : 1;
  return { cs, nx: Math.round(env.width / cs), ny: Math.round(env.height / cs) };
}

export function blockedMask(env: Environment, nx: number, ny: number, cs: number): Uint8Array {
  const m = new Uint8Array(nx * ny);
  for (const r of env.staticBlocked) {
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const cx = (x + 0.5) * cs, cy = (y + 0.5) * cs;
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) m[x + y * nx] = 1;
      }
  }
  return m;
}

/** Walking distance along the flow route S1->S2->...->Sk of a facility layout (metres). */
export function flowDistance(env: Environment): number {
  const key = `${env.layoutId}`;
  const hit = flowCache.get(key);
  if (hit !== undefined) return hit;
  const { cs, nx, ny } = introGridFor(env);
  const blocked = blockedMask(env, nx, ny, cs);
  const byId = new Map(env.fixedSources.map((s) => [s.id, s]));
  let total = 0;
  for (let i = 0; i + 1 < env.flowRoute.length; i++) {
    const a = byId.get(env.flowRoute[i]), b = byId.get(env.flowRoute[i + 1]);
    if (!a || !b) continue;
    const d = gridDistances(nx, ny, cs, blocked, Math.floor(a.x / cs), Math.floor(a.y / cs));
    const t = d[Math.min(nx - 1, Math.floor(b.x / cs)) + Math.min(ny - 1, Math.floor(b.y / cs)) * nx];
    total += Number.isFinite(t) ? t : 0;
  }
  flowCache.set(key, total);
  return total;
}

/** Importance weight of a spot (same ingredients as the full Lab's demand field, without the opponents). */
export function importanceAt(env: Environment, x: number, y: number, focus: Vec): number {
  let w = env.baseWeight;
  for (const s of env.fixedSources) w += s.weight * Math.exp(-((x - s.x) ** 2 + (y - s.y) ** 2) / (2 * s.sigma ** 2));
  if (env.mode === "soccer") w += env.focusWeight * Math.exp(-((x - focus.x) ** 2 + (y - focus.y) ** 2) / (2 * env.focusSigma ** 2));
  return w;
}

export function computeIntro(inp: IntroInput): IntroResult {
  const { env, agents, focus } = inp;
  const { cs, nx, ny } = introGridFor(env);
  const n = nx * ny;
  const blocked = blockedMask(env, nx, ny, cs);
  const radius = reachRadius(inp.speed, inp.seconds);
  const nearest = new Float64Array(n).fill(Infinity);
  const nearestAgent = new Int16Array(n).fill(-1);

  if (env.mode === "soccer") {
    for (let c = 0; c < n; c++) {
      const x = ((c % nx) + 0.5) * cs, y = (((c / nx) | 0) + 0.5) * cs;
      for (let i = 0; i < agents.length; i++) {
        const d = Math.hypot(x - agents[i].x, y - agents[i].y);
        if (d < nearest[c]) { nearest[c] = d; nearestAgent[c] = i; }
      }
    }
  } else {
    for (let i = 0; i < agents.length; i++) {
      const d = gridDistances(nx, ny, cs, blocked, Math.floor(agents[i].x / cs), Math.floor(agents[i].y / cs));
      for (let c = 0; c < n; c++) if (d[c] < nearest[c]) { nearest[c] = d[c]; nearestAgent[c] = i; }
    }
  }

  const state = new Uint8Array(n);
  const weight = new Float32Array(n);
  let free = 0, reached = 0, wAll = 0, wReached = 0, sumD = 0, nD = 0;
  let worst: IntroResult["worst"] = null;
  let worstW = -1;
  const lost = new Float64Array(Math.max(1, agents.length)); // unreached importance closest to each agent
  for (let c = 0; c < n; c++) {
    if (blocked[c]) { state[c] = 2; continue; }
    const x = ((c % nx) + 0.5) * cs, y = (((c / nx) | 0) + 0.5) * cs;
    const w = inp.weighted ? importanceAt(env, x, y, focus) : 1;
    weight[c] = w;
    free++; wAll += w;
    const d = nearest[c];
    const ok = d <= radius;
    state[c] = ok ? 1 : 0;
    if (ok) { reached++; wReached += w; }
    else if (nearestAgent[c] >= 0) lost[nearestAgent[c]] += w;
    if (Number.isFinite(d)) { sumD += d; nD++; }
    // worst-served spot = farthest unreached spot (ties: the more important one)
    if (Number.isFinite(d) && !ok && (!worst || d > worst.d + 1e-9 || (Math.abs(d - worst.d) < 1e-9 && w > worstW))) { worst = { x, y, d }; worstW = w; }
  }
  let busiest = -1, bl = 0;
  lost.forEach((v, i) => { if (v > bl) { bl = v; busiest = i; } });

  const stations = env.mode === "facility"
    ? env.fixedSources.map((s) => {
        const c = Math.min(nx - 1, Math.floor(s.x / cs)) + Math.min(ny - 1, Math.floor(s.y / cs)) * nx;
        const d = nearest[c];
        return { id: s.id, x: s.x, y: s.y, weight: s.weight, critical: !!s.critical, distance: d, reached: d <= radius, nearestAgent: nearestAgent[c] };
      })
    : [];

  return {
    nx, ny, cs, state, weight, radius,
    coverage: free ? reached / free : 0,
    weightedCoverage: wAll ? wReached / wAll : 0,
    meanDistance: nD ? sumD / nD : Infinity,
    worst, stations,
    flowDistance: env.mode === "facility" ? flowDistance(env) : null,
    busiest,
  };
}

/** Starting positions for the Start-Here page: the engine's own formations, nudged out of racks. */
export function defaultAgents(env: Environment, positions: { u: number; v: number }[]): Vec[] {
  const { cs, nx, ny } = introGridFor(env);
  const blocked = blockedMask(env, nx, ny, cs);
  return positions.map((p) => {
    let x = Math.min(env.width - 0.5, Math.max(0.5, p.u * env.width)), y = Math.min(env.height - 0.5, Math.max(0.5, p.v * env.height));
    const cell = (xx: number, yy: number) => Math.floor(xx / cs) + Math.floor(yy / cs) * nx;
    if (blocked[cell(x, y)]) {
      let best: Vec | null = null, bd = Infinity;
      for (let c = 0; c < nx * ny; c++) {
        if (blocked[c]) continue;
        const cx = ((c % nx) + 0.5) * cs, cy = (((c / nx) | 0) + 0.5) * cs;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) { bd = d; best = { x: cx, y: cy }; }
      }
      if (best) { x = best.x; y = best.y; }
    }
    return { x, y };
  });
}

/** Is a point free of racks? (used to refuse drops inside a rack) */
export function isFreePoint(env: Environment, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > env.width || y > env.height) return false;
  return !env.staticBlocked.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}
