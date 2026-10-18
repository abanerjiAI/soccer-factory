/**
 * LEVEL 1-2 — spatial model & metrics engine (domain-independent: used by soccer AND facility mode).
 *
 * Definitions (see src/content/metrics.ts for the full 13-point write-up of each):
 *  demand      D_c   (units/s)   Gaussian kernels around demand sources + uniform base, scaled so sum_c D_c = totalDemand.
 *  travel time t_ic  (s)         reaction + kinematic time from rest with speed & acceleration limits over path distance.
 *  accessibility p_ic            logistic in (t_ic - T*)/s : probability-like "arrives within response budget T*".
 *  coverage    cov_c = 1 - prod_i (1 - p_ic)        (pitch-control-inspired, independence ASSUMED)
 *  load        L_i = sum_c share_ic * D_c * cov_c   with share_ic = p_ic / sum_j p_jc
 *  utilisation rho_i = L_i / mu_i
 *  throughput  F = sum_i min(L_i, mu_i) / sum D          (served fraction)
 *  Conservation identity (tested):  F + capacityLoss + accessLoss = 1.
 */
import type { Environment, MetricSample, Rect, SimParams, Vec } from "./types";
import { travelTime } from "./geometry";

export interface Grid {
  nx: number;
  ny: number;
  w: number;
  h: number;
  cw: number;
  ch: number;
  n: number;
  cx: Float64Array;
  cy: Float64Array;
  cellArea: number;
}

export function makeGrid(env: Environment, scale = 1): Grid {
  const nx = Math.max(8, Math.round(env.nx * scale));
  const ny = Math.max(6, Math.round(env.ny * scale));
  return makeGridXY(env.width, env.height, nx, ny);
}

export function makeGridXY(w: number, h: number, nx: number, ny: number): Grid {
  const n = nx * ny;
  const cx = new Float64Array(n), cy = new Float64Array(n);
  const cw = w / nx, ch = h / ny;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      cx[j * nx + i] = (i + 0.5) * cw;
      cy[j * nx + i] = (j + 0.5) * ch;
    }
  return { nx, ny, w, h, cw, ch, n, cx, cy, cellArea: cw * ch };
}

export function rasterRects(g: Grid, rects: Rect[]): Uint8Array {
  const m = new Uint8Array(g.n);
  for (let c = 0; c < g.n; c++) for (const r of rects) if (g.cx[c] >= r.x && g.cx[c] <= r.x + r.w && g.cy[c] >= r.y && g.cy[c] <= r.y + r.h) m[c] = 1;
  return m;
}
export function rasterCircles(g: Grid, circles: { x: number; y: number; r: number }[]): Uint8Array {
  const m = new Uint8Array(g.n);
  for (let c = 0; c < g.n; c++) for (const k of circles) if (Math.hypot(g.cx[c] - k.x, g.cy[c] - k.y) <= k.r) m[c] = 1;
  return m;
}

class MinHeap {
  keys: number[] = [];
  ids: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(k: number, id: number) {
    const K = this.keys, I = this.ids;
    let i = K.length;
    K.push(k);
    I.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= K[i]) break;
      [K[p], K[i]] = [K[i], K[p]];
      [I[p], I[i]] = [I[i], I[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const K = this.keys, I = this.ids;
    const top: [number, number] = [K[0], I[0]];
    const lk = K.pop() as number, li = I.pop() as number;
    if (K.length) {
      K[0] = lk;
      I[0] = li;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < K.length && K[l] < K[m]) m = l;
        if (r < K.length && K[r] < K[m]) m = r;
        if (m === i) break;
        [K[m], K[i]] = [K[i], K[m]];
        [I[m], I[i]] = [I[i], I[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface EvalInput {
  /** available agents only */
  agents: Vec[];
  speedMult?: number[];
  focus: Vec;
  opponents: Vec[];
  spikes?: { x: number; y: number; extra: number; sigma: number }[];
  dynBlocked?: Uint8Array | null;
  capacityMult?: number;
  demandMult?: number;
}

export type FieldMetrics = Omit<MetricSample, "t" | "activeAgents" | "meanSpeed">;

export interface FieldResult {
  metrics: FieldMetrics;
  demand: Float64Array;
  cov: Float64Array;
  dead: Uint8Array;
  bott: Float64Array;
  access: Float64Array;
  load: number[];
  util: number[];
}

export class SpatialModel {
  grid: Grid;
  staticMask: Uint8Array;
  hasStatic: boolean;
  nFree: number;
  private rawFixed: Float64Array;
  private nominalTotal: number;
  private critical: Float64Array | null = null;

  constructor(
    public env: Environment,
    public params: SimParams,
    scale = 1,
  ) {
    this.grid = makeGrid(env, scale);
    this.staticMask = rasterRects(this.grid, env.staticBlocked);
    this.hasStatic = this.staticMask.some((v) => v === 1);
    this.nFree = this.staticMask.reduce((s, v) => s + (v ? 0 : 1), 0);
    this.rawFixed = new Float64Array(this.grid.n);
    for (let c = 0; c < this.grid.n; c++) if (!this.staticMask[c]) this.rawFixed[c] = env.baseWeight / this.nFree;
    let crit: Float64Array | null = null;
    for (const s of env.fixedSources) {
      this.kernelAdd(this.rawFixed, s.x, s.y, s.sigma, s.weight);
      if (s.critical) {
        crit = crit ?? new Float64Array(this.grid.n);
        this.kernelAdd(crit, s.x, s.y, s.sigma, 1);
      }
    }
    if (crit) {
      const tot = crit.reduce((a, b) => a + b, 0);
      if (tot > 0) for (let c = 0; c < crit.length; c++) crit[c] /= tot;
      this.critical = crit;
    }
    this.nominalTotal = env.baseWeight + env.fixedSources.reduce((s, x) => s + x.weight, 0) + env.focusWeight + env.opponents.length * env.opponentWeight;
  }

  private kernelAdd(out: Float64Array, x: number, y: number, sigma: number, weight: number) {
    const g = this.grid;
    const k = new Float64Array(g.n);
    let sum = 0;
    const inv = 1 / (2 * sigma * sigma);
    for (let c = 0; c < g.n; c++) {
      if (this.staticMask[c]) continue;
      const v = Math.exp(-((g.cx[c] - x) ** 2 + (g.cy[c] - y) ** 2) * inv);
      k[c] = v;
      sum += v;
    }
    if (sum < 1e-12) return;
    for (let c = 0; c < g.n; c++) out[c] += (weight * k[c]) / sum;
  }

  /** D_c in demand units / s; sums to totalDemand x demandMult x (1 + spike extras). */
  demandField(focus: Vec, opponents: Vec[], spikes: EvalInput["spikes"] = [], demandMult = 1): Float64Array {
    const e = this.env, g = this.grid;
    const raw = Float64Array.from(this.rawFixed);
    this.kernelAdd(raw, focus.x, focus.y, e.focusSigma, e.focusWeight);
    for (const o of opponents) this.kernelAdd(raw, o.x, o.y, e.opponentSigma, e.opponentWeight);
    for (const s of spikes ?? []) this.kernelAdd(raw, s.x, s.y, s.sigma, s.extra * this.nominalTotal);
    const scale = (this.params.totalDemand * demandMult) / this.nominalTotal;
    for (let c = 0; c < g.n; c++) raw[c] *= scale;
    return raw;
  }

  cellOf(x: number, y: number): number {
    const g = this.grid;
    const i = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.cw)));
    const j = Math.min(g.ny - 1, Math.max(0, Math.floor(y / g.ch)));
    return j * g.nx + i;
  }

  isFree(x: number, y: number, dyn?: Uint8Array | null): boolean {
    if (x < 0 || y < 0 || x > this.grid.w || y > this.grid.h) return false;
    const c = this.cellOf(x, y);
    return !this.staticMask[c] && !(dyn && dyn[c]);
  }

  snapFree(p: Vec): { p: Vec; moved: boolean } {
    if (this.isFree(p.x, p.y)) return { p, moved: false };
    const g = this.grid;
    let best = -1, bd = Infinity;
    for (let c = 0; c < g.n; c++) {
      if (this.staticMask[c]) continue;
      const d = Math.hypot(g.cx[c] - p.x, g.cy[c] - p.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return { p: { x: g.cx[best], y: g.cy[best] }, moved: true };
  }

  combineMask(dyn?: Uint8Array | null): Uint8Array | null {
    if (!dyn) return this.hasStatic ? this.staticMask : null;
    if (!this.hasStatic) return dyn;
    const m = new Uint8Array(this.grid.n);
    for (let c = 0; c < m.length; c++) m[c] = this.staticMask[c] | dyn[c];
    return m;
  }

  private lineClear(a: Vec, bx: number, by: number, blocked: Uint8Array): boolean {
    const g = this.grid;
    const L = Math.hypot(bx - a.x, by - a.y);
    const steps = Math.max(1, Math.ceil(L / (Math.min(g.cw, g.ch) / 2)));
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      if (blocked[this.cellOf(a.x + (bx - a.x) * f, a.y + (by - a.y) * f)]) return false;
    }
    return true;
  }

  /**
   * Path distance (m) from agent position to every cell centre.
   * No obstacles: Euclidean. With obstacles: Euclidean if the straight line is clear, otherwise 8-connected grid
   * Dijkstra distance (overestimates a true any-angle path by up to ~8%; documented limitation). Blocked cells => Infinity.
   */
  distancesFrom(a: Vec, blocked: Uint8Array | null): Float64Array {
    const g = this.grid, n = g.n;
    const out = new Float64Array(n);
    if (!blocked) {
      for (let c = 0; c < n; c++) out[c] = Math.hypot(g.cx[c] - a.x, g.cy[c] - a.y);
      return out;
    }
    const gd = new Float64Array(n).fill(Infinity);
    const start = this.cellOf(a.x, a.y);
    gd[start] = Math.hypot(g.cx[start] - a.x, g.cy[start] - a.y);
    const heap = new MinHeap();
    heap.push(gd[start], start);
    const dxs = [1, -1, 0, 0, 1, 1, -1, -1], dys = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.size) {
      const [d, u] = heap.pop();
      if (d > gd[u]) continue;
      const ux = u % g.nx, uy = (u - ux) / g.nx;
      for (let k = 0; k < 8; k++) {
        const vx = ux + dxs[k], vy = uy + dys[k];
        if (vx < 0 || vy < 0 || vx >= g.nx || vy >= g.ny) continue;
        const v = vy * g.nx + vx;
        if (blocked[v]) continue;
        if (k >= 4 && (blocked[uy * g.nx + vx] || blocked[vy * g.nx + ux])) continue;
        const nd = d + Math.hypot(dxs[k] * g.cw, dys[k] * g.ch);
        if (nd < gd[v]) {
          gd[v] = nd;
          heap.push(nd, v);
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (blocked[c]) out[c] = Infinity;
      else {
        const e = Math.hypot(g.cx[c] - a.x, g.cy[c] - a.y);
        out[c] = this.lineClear(a, g.cx[c], g.cy[c], blocked) ? e : gd[c];
      }
    }
    return out;
  }

  /** Material-flow cost (facility): sum over route legs of path distance (m per unit of product, unit volume per leg). */
  flowCost(): { total: number; legs: { from: string; to: string; dist: number }[] } {
    const e = this.env;
    const legs: { from: string; to: string; dist: number }[] = [];
    const mask = this.combineMask(null);
    for (let k = 0; k + 1 < e.flowRoute.length; k++) {
      const a = e.fixedSources.find((s) => s.id === e.flowRoute[k]);
      const b = e.fixedSources.find((s) => s.id === e.flowRoute[k + 1]);
      if (!a || !b) continue;
      const d = this.distancesFrom(a, mask)[this.cellOf(b.x, b.y)];
      legs.push({ from: a.id, to: b.id, dist: d });
    }
    return { total: legs.reduce((s, l) => s + l.dist, 0), legs };
  }

  evaluate(inp: EvalInput): FieldResult {
    const g = this.grid, P = this.params, n = g.n, na = inp.agents.length;
    const D = this.demandField(inp.focus, inp.opponents, inp.spikes, inp.demandMult ?? 1);
    let sumD = 0;
    for (let c = 0; c < n; c++) sumD += D[c];
    const blockedAll = this.combineMask(inp.dynBlocked);
    const p = new Float64Array(Math.max(1, na * n));
    const tmin = new Float64Array(n).fill(Infinity);
    const unc = new Float64Array(n).fill(1);
    for (let i = 0; i < na; i++) {
      const d = this.distancesFrom(inp.agents[i], blockedAll);
      const vE = P.vMax * (inp.speedMult?.[i] ?? 1);
      for (let c = 0; c < n; c++) {
        const t = travelTime(d[c], vE, P.aMax, P.reaction);
        const pic = Number.isFinite(t) ? 1 / (1 + Math.exp((t - P.responseBudget) / P.softness)) : 0;
        p[i * n + c] = pic;
        unc[c] *= 1 - pic;
        if (t < tmin[c]) tmin[c] = t;
      }
    }
    const cov = new Float64Array(n);
    for (let c = 0; c < n; c++) cov[c] = 1 - unc[c];

    const mu = P.capacityPerAgent * (inp.capacityMult ?? 1);
    const load = new Array<number>(na).fill(0);
    const bott = new Float64Array(n);
    const access = new Float64Array(n);
    for (let c = 0; c < n; c++) access[c] = D[c] * (1 - cov[c]);
    const share = (i: number, c: number, S: number) => (S > 0 ? p[i * n + c] / S : 0);
    const S = new Float64Array(n);
    for (let c = 0; c < n; c++) {
      let s = 0;
      for (let i = 0; i < na; i++) s += p[i * n + c];
      S[c] = s;
      if (s > 0) for (let i = 0; i < na; i++) load[i] += share(i, c, s) * D[c] * cov[c];
    }
    const util = load.map((l) => l / mu);
    const lossFrac = load.map((l) => (l > mu ? 1 - mu / l : 0));
    for (let c = 0; c < n; c++) {
      if (S[c] <= 0) continue;
      let b = 0;
      for (let i = 0; i < na; i++) if (lossFrac[i] > 0) b += share(i, c, S[c]) * D[c] * cov[c] * lossFrac[i];
      bott[c] = b;
    }

    const cap = 3 * P.responseBudget;
    const dead = new Uint8Array(n);
    const dMin = this.nFree > 0 && sumD > 0 ? (0.5 * sumD) / this.nFree : 0;
    let covW = 0, hardW = 0, respW = 0, deadN = 0, deadD = 0, accSum = 0, bottSum = 0;
    for (let c = 0; c < n; c++) {
      covW += D[c] * cov[c];
      if (tmin[c] <= P.responseBudget) hardW += D[c];
      respW += D[c] * Math.min(tmin[c], cap);
      accSum += access[c];
      bottSum += bott[c];
      if (!this.staticMask[c] && cov[c] < P.deadCoverage && D[c] >= dMin) {
        dead[c] = 1;
        deadN++;
        deadD += D[c];
      }
    }
    let served = 0, served12 = 0;
    for (let i = 0; i < na; i++) {
      served += Math.min(load[i], mu);
      served12 += Math.min(load[i], mu * 1.2);
    }
    const hasD = sumD > 0;
    let covArea = 0, hardArea = 0, respArea = 0, nf = 0;
    for (let c = 0; c < n; c++) {
      if (this.staticMask[c]) continue;
      nf++;
      covArea += cov[c];
      if (tmin[c] <= P.responseBudget) hardArea++;
      respArea += Math.min(tmin[c], cap);
    }
    let crit = hasD ? covW / sumD : nf ? covArea / nf : 0;
    if (this.critical && hasD) {
      crit = 0;
      for (let c = 0; c < n; c++) crit += this.critical[c] * cov[c];
    }
    const qp = util.length ? util.reduce((s, r) => s + (r >= 0.99 ? 20 : Math.min(20, r / (1 - r))), 0) / util.length : 0;
    const metrics: FieldMetrics = {
      coverage: hasD ? covW / sumD : nf ? covArea / nf : 0,
      hardCoverage: hasD ? hardW / sumD : nf ? hardArea / nf : 0,
      meanResponse: hasD ? respW / sumD : nf ? respArea / nf : cap,
      deadArea: deadN * g.cellArea,
      deadDemandShare: hasD ? deadD / sumD : 0,
      throughput: hasD ? served / sumD : 1,
      accessLoss: hasD ? accSum / sumD : 0,
      capacityLoss: hasD ? bottSum / sumD : 0,
      elevationGain: hasD ? (served12 - served) / sumD : 0,
      utilMean: util.length ? util.reduce((a, b) => a + b, 0) / util.length : 0,
      utilMax: util.length ? Math.max(...util) : 0,
      queuePressure: qp,
      criticalCoverage: crit,
      totalDemand: sumD,
    };
    return { metrics, demand: D, cov, dead, bott, access, load, util };
  }
}
