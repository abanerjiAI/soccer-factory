/**
 * Experiment engine: controlled comparisons (paired, common random numbers), Monte Carlo, sensitivity.
 * Resilience is reported as SEPARATE dimensions (magnitude, duration, speed, retained level); the only
 * combined quantity is the integrated loss ("resilience-triangle" area), which has a physical meaning (lost service integrated over time).
 */
import type { Disturbance, DisturbanceType, Formation, Mode, MetricSample, SimParams } from "./types";
import { MODEL_VERSION, SOFTWARE_VERSION } from "./types";
import { getEnvironment } from "./environments";
import { runSimulation, avgSeries } from "./sim";
import { disturbanceWindow, randomDisturbanceSet } from "./disturbances";
import { hashSeed, stableHash } from "./rng";
import { histogram, paired, quantile, summarize, welch } from "./stats";
import type { Summary } from "./stats";

export const tick = () => new Promise<void>((r) => setTimeout(r, 0));
export type Progress = (done: number, total: number, label?: string) => void;

export interface ExpBase {
  mode: Mode;
  layoutId: string;
  formation: Formation;
  params: SimParams;
  seed: number;
  gridScale?: number;
}

export type QKey = "coverage" | "throughput";

export interface Resilience {
  peakLoss: number;
  peakLossRel: number;
  meanLoss: number;
  retained: number;
  finalGap: number;
  recoveryTime: number | null;
  censored: boolean;
}

const EPS = 0.02;

export function resilienceOf(base: MetricSample[], dist: MetricSample[], key: QKey, win: { onset: number; end: number } | null, horizon: number): Resilience {
  if (!win) return { peakLoss: 0, peakLossRel: 0, meanLoss: 0, retained: 1, finalGap: 0, recoveryTime: 0, censored: false };
  const idx: number[] = [];
  base.forEach((s, i) => {
    if (s.t >= win.onset - 1e-9) idx.push(i);
  });
  const gap = idx.map((i) => base[i][key] - dist[i][key]);
  const dt = base.length > 1 ? base[1].t - base[0].t : 1;
  let peak = 0, peakRel = 0, retained = 1, area = 0;
  idx.forEach((i, k) => {
    const g = Math.max(0, gap[k]);
    if (g > peak) peak = g;
    if (base[i][key] > 1e-9) {
      peakRel = Math.max(peakRel, g / base[i][key]);
      retained = Math.min(retained, dist[i][key] / base[i][key]);
    }
    area += g * dt;
  });
  const span = Math.max(dt, horizon - win.onset);
  let rec: number | null = null;
  let censored = false;
  if (win.end >= horizon - dt) censored = true;
  else {
    for (let k = 0; k < idx.length; k++) {
      if (base[idx[k]].t < win.end - 1e-9) continue;
      let ok = true;
      for (let q = k; q < Math.min(idx.length, k + 3); q++) if (gap[q] > EPS) ok = false;
      if (ok) {
        rec = base[idx[k]].t - win.end;
        break;
      }
    }
  }
  return { peakLoss: peak, peakLossRel: peakRel, meanLoss: area / span, retained, finalGap: gap.length ? gap[gap.length - 1] : 0, recoveryTime: rec, censored };
}

export function runPair(b: ExpBase, ds: Disturbance[], simSeed: number) {
  const env = getEnvironment(b.mode, b.layoutId);
  const common = { env, formation: b.formation, params: b.params, seed: simSeed, gridScale: b.gridScale ?? 0.75 };
  const baseline = runSimulation({ ...common, disturbances: [] });
  const disturbed = ds.some((d) => d.enabled) ? runSimulation({ ...common, disturbances: ds }) : baseline;
  return { baseline, disturbed, win: disturbanceWindow(ds, b.params.duration) };
}

// ------------------------------------------------------------------ compare
export interface CompareConfig extends ExpBase {
  disturbances: Disturbance[];
  trials: number;
}
export interface MeanSeries {
  t: number[];
  coverage: number[];
  throughput: number[];
  deadArea: number[];
  capacityLoss: number[];
  accessLoss: number[];
  criticalCoverage: number[];
}
export interface ScenarioSummary {
  id: string;
  label: string;
  peakLoss: Summary;
  meanLoss: Summary;
  retained: Summary;
  finalGap: Summary;
  recoveryTime: Summary;
  fracRecovered: number;
  fracCensored: number;
  thrPeakLoss: Summary;
  thrMeanLoss: Summary;
  meanLossValues: number[];
  series: MeanSeries;
}
export interface CompareResult {
  config: CompareConfig;
  window: { onset: number; end: number } | null;
  baseline: { series: MeanSeries; coverageAvg: Summary; throughputAvg: Summary };
  scenarios: ScenarioSummary[];
  combined: ScenarioSummary | null;
  interaction: { combinedVsMaxSingle: ReturnType<typeof paired> | null; combinedMinusSum: Summary | null; fracCombinedWorse: number | null } | null;
  events: { t: number; text: string }[];
  hash: string;
  metadata: { modelVersion: string; softwareVersion: string; seed: number; trials: number };
}

const emptySeries = (n: number): MeanSeries => ({ t: [], coverage: new Array(n).fill(0), throughput: new Array(n).fill(0), deadArea: new Array(n).fill(0), capacityLoss: new Array(n).fill(0), accessLoss: new Array(n).fill(0), criticalCoverage: new Array(n).fill(0) });
function accumulate(ms: MeanSeries, s: MetricSample[]) {
  s.forEach((m, i) => {
    ms.t[i] = m.t;
    ms.coverage[i] += m.coverage;
    ms.throughput[i] += m.throughput;
    ms.deadArea[i] += m.deadArea;
    ms.capacityLoss[i] += m.capacityLoss;
    ms.accessLoss[i] += m.accessLoss;
    ms.criticalCoverage[i] += m.criticalCoverage;
  });
}
function finish(ms: MeanSeries, n: number) {
  (Object.keys(ms) as (keyof MeanSeries)[]).forEach((k) => {
    if (k !== "t") ms[k] = ms[k].map((v) => v / n);
  });
}

export async function compareScenarios(cfg: CompareConfig, onProgress?: Progress): Promise<CompareResult> {
  const enabled = cfg.disturbances.filter((d) => d.enabled);
  const env = getEnvironment(cfg.mode, cfg.layoutId);
  const labelOf = (d: Disturbance) => env.vocab.disturbance[d.type];
  const specs: { id: string; label: string; ds: Disturbance[] }[] = enabled.map((d) => ({ id: d.id, label: labelOf(d), ds: [d] }));
  if (enabled.length >= 2) specs.push({ id: "combined", label: "COMBINED (all enabled)", ds: enabled });
  const horizon = cfg.params.duration;
  const nS = Math.round(horizon / cfg.params.metricEvery) + 1;
  const baseSeries = emptySeries(nS);
  const acc = specs.map(() => ({
    peak: [] as number[], mean: [] as number[], ret: [] as number[], fin: [] as number[], rec: [] as number[], recN: 0, cens: 0,
    tPeak: [] as number[], tMean: [] as number[], series: emptySeries(nS),
  }));
  const baseCov: number[] = [], baseThr: number[] = [];
  let events: { t: number; text: string }[] = [];
  const win = enabled.length ? disturbanceWindow(cfg.disturbances, horizon) : null;

  for (let k = 0; k < cfg.trials; k++) {
    const simSeed = hashSeed(cfg.seed, k);
    const env2 = getEnvironment(cfg.mode, cfg.layoutId);
    const common = { env: env2, formation: cfg.formation, params: cfg.params, seed: simSeed, gridScale: cfg.gridScale ?? 0.75 };
    const base = runSimulation({ ...common, disturbances: [] });
    accumulate(baseSeries, base.series);
    baseCov.push(avgSeries(base.series, "coverage"));
    baseThr.push(avgSeries(base.series, "throughput"));
    specs.forEach((sp, i) => {
      const r = runSimulation({ ...common, disturbances: sp.ds });
      if (k === 0 && sp.id === specs[specs.length - 1].id) events = r.events;
      const w = disturbanceWindow(sp.ds, horizon);
      const rc = resilienceOf(base.series, r.series, "coverage", w, horizon);
      const rt = resilienceOf(base.series, r.series, "throughput", w, horizon);
      const a = acc[i];
      a.peak.push(rc.peakLoss);
      a.mean.push(rc.meanLoss);
      a.ret.push(rc.retained);
      a.fin.push(rc.finalGap);
      if (rc.recoveryTime !== null) {
        a.rec.push(rc.recoveryTime);
        a.recN++;
      }
      if (rc.censored) a.cens++;
      a.tPeak.push(rt.peakLoss);
      a.tMean.push(rt.meanLoss);
      accumulate(a.series, r.series);
    });
    onProgress?.(k + 1, cfg.trials, `trial ${k + 1}/${cfg.trials}`);
    await tick();
  }
  finish(baseSeries, cfg.trials);
  const summaries: ScenarioSummary[] = specs.map((sp, i) => {
    const a = acc[i];
    finish(a.series, cfg.trials);
    return {
      id: sp.id, label: sp.label, peakLoss: summarize(a.peak), meanLoss: summarize(a.mean), retained: summarize(a.ret), finalGap: summarize(a.fin),
      recoveryTime: summarize(a.rec), fracRecovered: a.recN / cfg.trials, fracCensored: a.cens / cfg.trials,
      thrPeakLoss: summarize(a.tPeak), thrMeanLoss: summarize(a.tMean), meanLossValues: a.mean, series: a.series,
    };
  });
  const combined = summaries.find((s) => s.id === "combined") ?? null;
  const singles = summaries.filter((s) => s.id !== "combined");
  let interaction: CompareResult["interaction"] = null;
  if (combined && singles.length >= 2) {
    const maxSingle = combined.meanLossValues.map((_, k) => Math.max(...singles.map((s) => s.meanLossValues[k])));
    const sumSingle = combined.meanLossValues.map((_, k) => singles.reduce((s, x) => s + x.meanLossValues[k], 0));
    const p = paired(combined.meanLossValues, maxSingle);
    interaction = {
      combinedVsMaxSingle: p,
      combinedMinusSum: summarize(combined.meanLossValues.map((v, k) => v - sumSingle[k])),
      fracCombinedWorse: p.fracPositive,
    };
  }
  const core = { b: baseSeries.coverage, s: summaries.map((s) => [s.meanLoss.mean, s.peakLoss.mean, s.thrMeanLoss.mean]) };
  return {
    config: cfg, window: win, baseline: { series: baseSeries, coverageAvg: summarize(baseCov), throughputAvg: summarize(baseThr) },
    scenarios: summaries, combined, interaction, events,
    hash: stableHash(core), metadata: { modelVersion: MODEL_VERSION, softwareVersion: SOFTWARE_VERSION, seed: cfg.seed, trials: cfg.trials },
  };
}

// ------------------------------------------------------------------ Monte Carlo
export interface MCConfig extends ExpBase {
  trials: number;
  types: DisturbanceType[];
  pInclude: number;
}
export interface MCTrial {
  seed: number;
  present: DisturbanceType[];
  peakLoss: number;
  meanLoss: number;
  thrMeanLoss: number;
  recovered: boolean;
  censored: boolean;
  recoveryTime: number | null;
  disturbances: { type: string; severity: number; start: number; duration: number }[];
}
export interface MCResult {
  config: MCConfig;
  trials: MCTrial[];
  nNoDisturbance: number;
  peak: Summary & { q05: number; q95: number };
  mean: Summary & { q05: number; q95: number };
  hist: { lo: number; hi: number; count: number }[];
  fracRecovered: number;
  fracCensored: number;
  byType: { type: DisturbanceType; nWith: number; nWithout: number; meanWith: number; meanWithout: number; diff: number; lo: number; hi: number; excludesZero: boolean }[];
  hash: string;
  metadata: { modelVersion: string; softwareVersion: string; seed: number; trials: number };
}

export async function monteCarlo(cfg: MCConfig, onProgress?: Progress): Promise<MCResult> {
  const env = getEnvironment(cfg.mode, cfg.layoutId);
  const trials: MCTrial[] = [];
  const horizon = cfg.params.duration;
  for (let k = 0; k < cfg.trials; k++) {
    const trialSeed = hashSeed(cfg.seed, k, 31337);
    const ds = randomDisturbanceSet(trialSeed, env, cfg.formation.positions.length, cfg.types, cfg.pInclude);
    const on = ds.filter((d) => d.enabled);
    const { baseline, disturbed, win } = runPair(cfg, ds, hashSeed(cfg.seed, k));
    const rc = resilienceOf(baseline.series, disturbed.series, "coverage", win, horizon);
    const rt = resilienceOf(baseline.series, disturbed.series, "throughput", win, horizon);
    trials.push({
      seed: trialSeed, present: on.map((d) => d.type), peakLoss: rc.peakLoss, meanLoss: rc.meanLoss, thrMeanLoss: rt.meanLoss,
      recovered: rc.recoveryTime !== null, censored: rc.censored, recoveryTime: rc.recoveryTime,
      disturbances: on.map((d) => ({ type: d.type, severity: +d.severity.toFixed(3), start: +d.start.toFixed(2), duration: +d.duration.toFixed(2) })),
    });
    onProgress?.(k + 1, cfg.trials, `trial ${k + 1}/${cfg.trials}`);
    if (k % 2 === 1) await tick();
  }
  const peaks = trials.map((t) => t.peakLoss), means = trials.map((t) => t.meanLoss);
  const withD = trials.filter((t) => t.present.length > 0);
  const byType = cfg.types.map((type) => {
    const w = trials.filter((t) => t.present.includes(type)).map((t) => t.meanLoss);
    const wo = trials.filter((t) => !t.present.includes(type)).map((t) => t.meanLoss);
    const c = w.length > 1 && wo.length > 1 ? welch(w, wo) : { diff: NaN, lo: NaN, hi: NaN, excludesZero: false };
    return { type, nWith: w.length, nWithout: wo.length, meanWith: summarize(w).mean, meanWithout: summarize(wo).mean, diff: c.diff, lo: c.lo, hi: c.hi, excludesZero: c.excludesZero };
  });
  return {
    config: cfg, trials, nNoDisturbance: trials.length - withD.length,
    peak: { ...summarize(peaks), q05: quantile(peaks, 0.05), q95: quantile(peaks, 0.95) },
    mean: { ...summarize(means), q05: quantile(means, 0.05), q95: quantile(means, 0.95) },
    hist: histogram(peaks, 10),
    fracRecovered: withD.length ? withD.filter((t) => t.recovered).length / withD.length : NaN,
    fracCensored: withD.length ? withD.filter((t) => t.censored).length / withD.length : NaN,
    byType,
    hash: stableHash({ p: peaks, m: means }),
    metadata: { modelVersion: MODEL_VERSION, softwareVersion: SOFTWARE_VERSION, seed: cfg.seed, trials: cfg.trials },
  };
}

// ------------------------------------------------------------------ sensitivity
export const SENS_PARAMS: { key: keyof SimParams | "severity" | "duration"; label: string }[] = [
  { key: "vMax", label: "Top speed" },
  { key: "aMax", label: "Acceleration limit" },
  { key: "reaction", label: "Reaction time" },
  { key: "responseBudget", label: "Response budget T*" },
  { key: "softness", label: "Accessibility softness s" },
  { key: "capacityPerAgent", label: "Capacity per agent" },
  { key: "totalDemand", label: "Total demand" },
  { key: "ballResponse", label: "Focus (ball) response" },
  { key: "formationRadius", label: "Formation radius" },
  { key: "severity", label: "Disturbance severity" },
  { key: "duration", label: "Disturbance duration" },
];

export interface SensConfig extends ExpBase {
  disturbances: Disturbance[];
  trials: number;
  levels: number[];
}
export interface SensRow {
  key: string;
  label: string;
  levels: number[];
  baseCoverage: number[];
  baseThroughput: number[];
  meanLoss: number[];
  peakLoss: number[];
  elasticityLoss: number;
  rangeCoverage: number;
  rangeLoss: number;
}
export interface SensResult {
  config: SensConfig;
  rows: SensRow[];
  hash: string;
  metadata: { modelVersion: string; softwareVersion: string; seed: number; trials: number };
}

export async function sensitivity(cfg: SensConfig, onProgress?: Progress): Promise<SensResult> {
  const horizon = cfg.params.duration;
  const evalVariant = (params: SimParams, ds: Disturbance[]) => {
    const bc: number[] = [], bt: number[] = [], ml: number[] = [], pl: number[] = [];
    for (let k = 0; k < cfg.trials; k++) {
      const { baseline, disturbed, win } = runPair({ ...cfg, params }, ds, hashSeed(cfg.seed, k));
      const r = resilienceOf(baseline.series, disturbed.series, "coverage", win, horizon);
      bc.push(avgSeries(baseline.series, "coverage"));
      bt.push(avgSeries(baseline.series, "throughput"));
      ml.push(r.meanLoss);
      pl.push(r.peakLoss);
    }
    const m = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    return { bc: m(bc), bt: m(bt), ml: m(ml), pl: m(pl) };
  };
  const total = SENS_PARAMS.length * cfg.levels.filter((l) => l !== 1).length + 1;
  let done = 0;
  const center = evalVariant(cfg.params, cfg.disturbances);
  onProgress?.(++done, total, "reference");
  await tick();
  const rows: SensRow[] = [];
  for (const sp of SENS_PARAMS) {
    const outs: { bc: number; bt: number; ml: number; pl: number }[] = [];
    for (const m of cfg.levels) {
      if (m === 1) {
        outs.push(center);
        continue;
      }
      let params = cfg.params;
      let ds = cfg.disturbances;
      if (sp.key === "severity") ds = ds.map((d) => ({ ...d, severity: Math.min(1, d.severity * m) }));
      else if (sp.key === "duration") ds = ds.map((d) => ({ ...d, duration: d.type === "focus_relocation" ? 0 : d.duration * m }));
      else params = { ...params, [sp.key]: (params[sp.key as keyof SimParams] as number) * m } as SimParams;
      outs.push(evalVariant(params, ds));
      onProgress?.(++done, total, `${sp.label} x${m}`);
      await tick();
    }
    const at = (m: number) => cfg.levels.indexOf(m);
    const lo = at(0.75), hi = at(1.25), c = at(1);
    const el = lo >= 0 && hi >= 0 && c >= 0 && outs[c].ml > 1e-9 ? (outs[hi].ml - outs[lo].ml) / outs[c].ml / 0.5 : 0;
    const rng = (f: (o: (typeof outs)[number]) => number) => Math.max(...outs.map(f)) - Math.min(...outs.map(f));
    rows.push({
      key: String(sp.key), label: sp.label, levels: cfg.levels, baseCoverage: outs.map((o) => o.bc), baseThroughput: outs.map((o) => o.bt),
      meanLoss: outs.map((o) => o.ml), peakLoss: outs.map((o) => o.pl), elasticityLoss: el, rangeCoverage: rng((o) => o.bc), rangeLoss: rng((o) => o.ml),
    });
  }
  return { config: cfg, rows, hash: stableHash(rows.map((r) => [r.baseCoverage, r.meanLoss])), metadata: { modelVersion: MODEL_VERSION, softwareVersion: SOFTWARE_VERSION, seed: cfg.seed, trials: cfg.trials } };
}
