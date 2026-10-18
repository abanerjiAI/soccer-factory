/**
 * LEVEL 4 — optimization. Position optimisation by simulated annealing (a HEURISTIC: no global-optimality claim is ever made;
 * we run several restarts and report their spread). Objectives are kept SEPARATE; Pareto filtering is used instead of a weighted sum.
 */
import type { Environment, Formation, SimParams, Vec } from "./types";
import { SpatialModel } from "./spatial";
import { hopTarget, opponentPositions } from "./environments";
import { gaussian, hashSeed, mulberry32, stableHash } from "./rng";
import { tick } from "./experiments";
import type { Progress } from "./experiments";

export type ObjKey = "coverage" | "deadShare" | "throughput" | "vulnerability" | "utilMax" | "meanResponse";
export const OBJECTIVES: { key: ObjKey; label: string; dir: "max" | "min"; meaning: string }[] = [
  { key: "coverage", label: "Demand-weighted coverage", dir: "max", meaning: "Share of demand that some agent can reach within the response budget (soft)." },
  { key: "deadShare", label: "Dead-zone demand share", dir: "min", meaning: "Share of total demand located in cells with coverage below the dead threshold." },
  { key: "throughput", label: "Throughput (served fraction)", dir: "max", meaning: "Fraction of demand actually served after access AND capacity limits." },
  { key: "vulnerability", label: "Critical-zone vulnerability", dir: "min", meaning: "1 - coverage of the critical zone (goal mouth / critical station)." },
  { key: "utilMax", label: "Peak utilisation", dir: "min", meaning: "Utilisation of the most loaded agent (>1 means that agent is a bottleneck)." },
  { key: "meanResponse", label: "Mean response time (s)", dir: "min", meaning: "Demand-weighted mean of the fastest arrival time (capped at 3 T*). p-median style objective." },
];
export type Objectives = Record<ObjKey, number>;

export function formationPositions(model: SpatialModel, f: Formation): Vec[] {
  const g = model.grid;
  return f.positions.map((s) => model.snapFree({ x: Math.min(g.w, Math.max(0, s.u * g.w)), y: Math.min(g.h, Math.max(0, s.v * g.h)) }).p);
}

export class StaticEvaluator {
  model: SpatialModel;
  foci: { focus: Vec; opps: Vec[] }[];
  evals = 0;
  constructor(public env: Environment, public params: SimParams, opts: { gridScale?: number; nFocus?: number; seed?: number } = {}) {
    this.model = new SpatialModel(env, params, opts.gridScale ?? 0.7);
    const n = opts.nFocus ?? 4, seed = opts.seed ?? 1;
    this.foci = [];
    for (let i = 0; i < n; i++) {
      const focus = i === 0 ? env.focusStart : hopTarget(env, seed, i);
      this.foci.push({ focus, opps: opponentPositions(env, focus, 0, seed, params) });
    }
  }
  evaluate(pos: Vec[], unavailable: number[] = []): Objectives {
    const agents = pos.filter((_, i) => !unavailable.includes(i));
    const acc: Objectives = { coverage: 0, deadShare: 0, throughput: 0, vulnerability: 0, utilMax: 0, meanResponse: 0 };
    for (const f of this.foci) {
      const m = this.model.evaluate({ agents, focus: f.focus, opponents: f.opps }).metrics;
      acc.coverage += m.coverage;
      acc.deadShare += m.deadDemandShare;
      acc.throughput += m.throughput;
      acc.vulnerability += 1 - m.criticalCoverage;
      acc.utilMax += m.utilMax;
      acc.meanResponse += m.meanResponse;
      this.evals++;
    }
    (Object.keys(acc) as ObjKey[]).forEach((k) => (acc[k] /= this.foci.length));
    return acc;
  }
}

export interface AnnealResult {
  best: Vec[];
  bestVal: number;
  startVal: number;
  history: number[];
  accepted: number;
  iters: number;
}

export async function anneal(o: { start: Vec[]; f: (p: Vec[]) => number; model: SpatialModel; minSpacing: number; iters: number; seed: number; step0: number; onTick?: (k: number) => void }): Promise<AnnealResult> {
  const rng = mulberry32(o.seed);
  let cur = o.start.map((p) => ({ ...p }));
  let curVal = o.f(cur);
  const startVal = curVal;
  let best = cur.map((p) => ({ ...p })), bestVal = curVal;
  const T0 = 0.01 * Math.max(Math.abs(startVal), 0.05);
  const history: number[] = [bestVal];
  let accepted = 0;
  for (let k = 0; k < o.iters; k++) {
    const frac = k / o.iters;
    const i = Math.floor(rng() * cur.length);
    const sigma = o.step0 * (1 - 0.9 * frac);
    const cand = { x: cur[i].x + gaussian(rng) * sigma, y: cur[i].y + gaussian(rng) * sigma };
    if (!o.model.isFree(cand.x, cand.y)) continue;
    let dMin = Infinity, dCur = Infinity;
    cur.forEach((q, j) => {
      if (j === i) return;
      dMin = Math.min(dMin, Math.hypot(q.x - cand.x, q.y - cand.y));
      dCur = Math.min(dCur, Math.hypot(q.x - cur[i].x, q.y - cur[i].y));
    });
    if (dMin < o.minSpacing && dMin < dCur) continue;
    const prev = cur[i];
    cur[i] = cand;
    const v = o.f(cur);
    const T = T0 * (1 - 0.9 * frac);
    if (v <= curVal || rng() < Math.exp(-(v - curVal) / T)) {
      curVal = v;
      accepted++;
      if (v < bestVal) {
        bestVal = v;
        best = cur.map((p) => ({ ...p }));
      }
    } else cur[i] = prev;
    if (k % 25 === 0) history.push(bestVal);
    if (k % 40 === 0) {
      o.onTick?.(k);
      await tick();
    }
  }
  return { best, bestVal, startVal, history, accepted, iters: o.iters };
}

export interface OptimizeConfig {
  env: Environment;
  params: SimParams;
  formation: Formation;
  objective: ObjKey;
  restarts: number;
  iters: number;
  seed: number;
}
export interface OptimizeResult {
  objective: ObjKey;
  dir: "max" | "min";
  startFormation: string;
  startObjectives: Objectives;
  restartValues: number[];
  history: number[];
  best: Vec[];
  bestObjectives: Objectives;
  start: Vec[];
  evaluations: number;
  explanation: { objective: string; variables: string; constraints: string[]; method: string; assumptions: string[]; caveat: string };
  hash: string;
}

export async function optimizePositions(cfg: OptimizeConfig, onProgress?: Progress): Promise<OptimizeResult> {
  const ev = new StaticEvaluator(cfg.env, cfg.params, { seed: cfg.seed });
  const def = OBJECTIVES.find((o) => o.key === cfg.objective)!;
  const sign = def.dir === "max" ? -1 : 1;
  const f = (p: Vec[]) => sign * ev.evaluate(p)[cfg.objective];
  const start = formationPositions(ev.model, cfg.formation);
  const startObj = ev.evaluate(start);
  let best: Vec[] = start, bestV = f(start), hist: number[] = [];
  const restartValues: number[] = [];
  for (let r = 0; r < cfg.restarts; r++) {
    const rng = mulberry32(hashSeed(cfg.seed, r, 55));
    const s0 = r === 0 ? start : start.map((p) => ev.model.snapFree({ x: Math.min(cfg.env.width, Math.max(0, p.x + gaussian(rng) * 6)), y: Math.min(cfg.env.height, Math.max(0, p.y + gaussian(rng) * 6)) }).p);
    const res = await anneal({ start: s0, f, model: ev.model, minSpacing: cfg.params.minSpacing, iters: cfg.iters, seed: hashSeed(cfg.seed, r), step0: 0.12 * Math.min(cfg.env.width, cfg.env.height), onTick: (k) => onProgress?.(r * cfg.iters + k, cfg.restarts * cfg.iters, `restart ${r + 1}/${cfg.restarts}`) });
    restartValues.push(sign * res.bestVal);
    if (res.bestVal < bestV) {
      bestV = res.bestVal;
      best = res.best;
      hist = res.history.map((h) => sign * h);
    }
  }
  const bestObj = ev.evaluate(best);
  return {
    objective: cfg.objective, dir: def.dir, startFormation: cfg.formation.id, startObjectives: startObj, restartValues, history: hist, best, bestObjectives: bestObj, start, evaluations: ev.evals,
    explanation: {
      objective: `${def.dir === "max" ? "Maximise" : "Minimise"} ${def.label}, averaged over ${ev.foci.length} reference ${cfg.env.vocab.focus} situations. ${def.meaning}`,
      variables: `${cfg.formation.positions.length * 2} continuous variables: (x, y) of each ${cfg.env.vocab.agent} in metres.`,
      constraints: [`inside the ${cfg.env.vocab.fieldName} boundary`, "outside restricted areas", `minimum spacing ${cfg.params.minSpacing} m between ${cfg.env.vocab.agents}`, "agent count fixed (resource limit)"],
      method: `Simulated annealing, ${cfg.restarts} restart(s) x ${cfg.iters} iterations, Gaussian moves of one agent at a time, Metropolis acceptance, cooling x0.1.`,
      assumptions: ["static snapshot objective (no movement dynamics)", "reference situations are fixed samples, not all possible play", "model parameters are ASSUMED, not calibrated"],
      caveat: "Simulated annealing is a heuristic. The result is the best layout FOUND under these objectives and constraints; it is not proven globally optimal. Differences between restarts indicate how rugged the objective landscape is.",
    },
    hash: stableHash({ o: cfg.objective, v: restartValues, b: best.map((p) => [p.x, p.y]) }),
  };
}

export interface CandidateRow {
  label: string;
  kind: "formation" | "optimised" | "perturbed";
  objectives: Objectives;
  positions: Vec[];
  pareto: boolean;
}
export const PARETO_KEYS: ObjKey[] = ["coverage", "vulnerability", "deadShare", "utilMax"];

export function paretoFlags(rows: { objectives: Objectives }[], keys: ObjKey[] = PARETO_KEYS): boolean[] {
  const better = (a: Objectives, b: Objectives, k: ObjKey) => (OBJECTIVES.find((o) => o.key === k)!.dir === "max" ? a[k] - b[k] : b[k] - a[k]);
  return rows.map((r, i) => !rows.some((q, j) => j !== i && keys.every((k) => better(q.objectives, r.objectives, k) >= -1e-12) && keys.some((k) => better(q.objectives, r.objectives, k) > 1e-9)));
}

export async function paretoStudy(cfg: { env: Environment; params: SimParams; formations: Formation[]; seed: number; iters: number }, onProgress?: Progress) {
  const ev = new StaticEvaluator(cfg.env, cfg.params, { seed: cfg.seed });
  const rows: CandidateRow[] = [];
  const add = (label: string, kind: CandidateRow["kind"], positions: Vec[]) => rows.push({ label, kind, positions, objectives: ev.evaluate(positions), pareto: false });
  cfg.formations.forEach((f) => add(f.name, "formation", formationPositions(ev.model, f)));
  const base = rows.reduce((b, r) => (r.objectives.coverage > b.objectives.coverage ? r : b), rows[0]);
  const targets: ObjKey[] = ["coverage", "vulnerability", "deadShare"];
  for (let t = 0; t < targets.length; t++) {
    const def = OBJECTIVES.find((o) => o.key === targets[t])!;
    const sign = def.dir === "max" ? -1 : 1;
    const res = await anneal({ start: base.positions, f: (p) => sign * ev.evaluate(p)[targets[t]], model: ev.model, minSpacing: cfg.params.minSpacing, iters: cfg.iters, seed: hashSeed(cfg.seed, t, 7), step0: 0.12 * Math.min(cfg.env.width, cfg.env.height) });
    add(`SA: ${def.label}`, "optimised", res.best);
    onProgress?.(t + 1, targets.length + 1, `optimising ${def.label}`);
  }
  const rng = mulberry32(hashSeed(cfg.seed, 4242));
  const pool = rows.slice();
  for (let i = 0; i < 16; i++) {
    const src = pool[Math.floor(rng() * pool.length)];
    const pos = src.positions.map((p) => ev.model.snapFree({ x: Math.min(cfg.env.width, Math.max(0, p.x + gaussian(rng) * 5)), y: Math.min(cfg.env.height, Math.max(0, p.y + gaussian(rng) * 5)) }).p);
    add(`perturbed #${i + 1} (of ${src.label})`, "perturbed", pos);
  }
  onProgress?.(targets.length + 1, targets.length + 1, "done");
  const flags = paretoFlags(rows);
  rows.forEach((r, i) => (r.pareto = flags[i]));
  return { rows, keys: PARETO_KEYS, evaluations: ev.evals, hash: stableHash(rows.map((r) => r.objectives)) };
}

export interface RobustResult {
  rows: { label: string; positions: Vec[]; nominal: number; singleFailMean: number; singleFailWorst: number; doubleFailMean: number; doubleFailWorst: number }[];
  explanation: { objective: string; variables: string; constraints: string[]; method: string; caveat: string };
  hash: string;
}

/** Nominal-optimal vs robust (worst-case over all single-agent failures) layout, judged on HELD-OUT double failures & foci. */
export async function robustStudy(cfg: { env: Environment; params: SimParams; formation: Formation; seed: number; iters: number }, onProgress?: Progress): Promise<RobustResult> {
  const train = new StaticEvaluator(cfg.env, cfg.params, { seed: cfg.seed, nFocus: 3 });
  const test = new StaticEvaluator(cfg.env, cfg.params, { seed: cfg.seed + 1000, nFocus: 4 });
  const start = formationPositions(train.model, cfg.formation);
  const N = start.length;
  const step0 = 0.12 * Math.min(cfg.env.width, cfg.env.height);
  const nominalFn = (p: Vec[]) => -train.evaluate(p).coverage;
  const robustFn = (p: Vec[]) => {
    let worst = train.evaluate(p).coverage;
    for (let i = 0; i < N; i++) worst = Math.min(worst, train.evaluate(p, [i]).coverage);
    return -worst;
  };
  const nom = await anneal({ start, f: nominalFn, model: train.model, minSpacing: cfg.params.minSpacing, iters: cfg.iters, seed: hashSeed(cfg.seed, 1), step0, onTick: (k) => onProgress?.(k, cfg.iters * 2, "nominal optimisation") });
  const rob = await anneal({ start, f: robustFn, model: train.model, minSpacing: cfg.params.minSpacing, iters: Math.round(cfg.iters * 0.6), seed: hashSeed(cfg.seed, 2), step0, onTick: (k) => onProgress?.(cfg.iters + k, cfg.iters * 2, "robust optimisation") });
  const rng = mulberry32(hashSeed(cfg.seed, 99));
  const pairs: number[][] = [];
  while (pairs.length < 12) {
    const a = Math.floor(rng() * N), b = Math.floor(rng() * N);
    if (a !== b) pairs.push([a, b]);
  }
  const judge = (label: string, positions: Vec[]) => {
    const s = Array.from({ length: N }, (_, i) => test.evaluate(positions, [i]).coverage);
    const d = pairs.map((p) => test.evaluate(positions, p).coverage);
    return { label, positions, nominal: test.evaluate(positions).coverage, singleFailMean: s.reduce((a, b) => a + b, 0) / N, singleFailWorst: Math.min(...s), doubleFailMean: d.reduce((a, b) => a + b, 0) / d.length, doubleFailWorst: Math.min(...d) };
  };
  const rows = [judge(`Start formation (${cfg.formation.name})`, start), judge("Nominal-optimal (max coverage, no failures)", nom.best), judge("Robust-optimal (max worst-case over single failures)", rob.best)];
  return {
    rows,
    explanation: {
      objective: "Nominal: maximise mean coverage over 3 training situations. Robust: maximise the WORST coverage over {no failure, each single-agent failure}.",
      variables: `${N * 2} continuous position variables`,
      constraints: ["inside boundary", "outside restricted areas", `spacing >= ${cfg.params.minSpacing} m`],
      method: `Simulated annealing (${cfg.iters} / ${Math.round(cfg.iters * 0.6)} iterations). Evaluation uses HELD-OUT situations (different focus samples) and DOUBLE failures never seen during optimisation.`,
      caveat: "Robustness here is relative to the stated failure set only. A layout robust to agent failures may be fragile to other disturbances (blocked regions, demand spikes).",
    },
    hash: stableHash(rows.map((r) => [r.nominal, r.singleFailWorst, r.doubleFailMean])),
  };
}
