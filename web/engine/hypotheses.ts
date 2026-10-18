/**
 * Hypothesis tests H1-H5. Decision criteria are PRE-REGISTERED in this file (before any result is seen) and verdicts are COMPUTED.
 * Selection (which formation is "best") uses odd seeds; confirmation uses even seeds => avoids winner's-curse bias.
 * All outcomes are SIMULATED results under ASSUMED parameters. Nothing here is a real-world measurement.
 */
import type { Formation, Mode, SimParams } from "./types";
import { getEnvironment, formationsFor } from "./environments";
import { avgSeries, runSimulation } from "./sim";
import { referenceSuite, randomDisturbanceSet } from "./disturbances";
import { compareScenarios, resilienceOf, runPair, tick } from "./experiments";
import type { Progress } from "./experiments";
import { robustStudy } from "./optimize";
import { hashSeed, stableHash } from "./rng";
import { paired, spearman, summarize } from "./stats";

export type Verdict = "SUPPORTED" | "NOT SUPPORTED" | "INCONCLUSIVE";
export interface HypothesisMeta {
  id: string;
  title: string;
  statement: string;
  variables: { independent: string; dependent: string; controls: string };
  experiment: string;
  support: string;
  contradict: string;
  alternatives: string[];
  limitations: string[];
}
export interface HypothesisResult {
  id: string;
  verdict: Verdict;
  evidence: string[];
  table: { headers: string[]; rows: (string | number)[][] };
  trials: number;
  hash: string;
  mode: Mode;
}
export interface HypBase {
  mode: Mode;
  layoutId: string;
  params: SimParams;
  seed: number;
  trials: number;
}

export const MIN_EFFECT_COVERAGE = 0.02;
export const MIN_EFFECT_LOSS = 0.005;

export const HYPOTHESES: HypothesisMeta[] = [
  {
    id: "H1",
    title: "Configuration affects spatial coverage",
    statement: "Under identical demand conditions, different formations/configurations produce different time-averaged demand-weighted coverage, by more than a minimum meaningful effect.",
    variables: { independent: "formation (5 soccer / 4 facility operator arrangements)", dependent: "time-averaged coverage (baseline, no disturbance)", controls: "model parameters, demand model, seeds (common random numbers)" },
    experiment: "Run every formation on the same seeds. Choose best and worst on ODD seeds; test best - worst on EVEN seeds with a paired 95% CI.",
    support: `Confirmation-set paired CI of (best - worst) has lower bound > ${MIN_EFFECT_COVERAGE} coverage units.`,
    contradict: "CI includes 0 or the selected best is not better than the selected worst in the confirmation set.",
    alternatives: ["Differences may reflect my ASSUMED demand weights (e.g. goal weight), not formation geometry.", "Metric definition (soft coverage with T*) may favour compact shapes."],
    limitations: ["Only the formations listed are tested.", "Variation comes only from seeds (focus path, opponent wobble); no real-world variability."],
  },
  {
    id: "H2",
    title: "The coverage-maximising configuration is not the most resilient",
    statement: "The formation with the highest baseline coverage is not the formation with the smallest relative coverage loss under a fixed combined disturbance.",
    variables: { independent: "formation", dependent: "baseline coverage; relative integrated coverage loss under the reference combined disturbance", controls: "reference disturbance suite (1 agent out + region blocked + demand spike), seeds" },
    experiment: "Odd seeds select f* (max baseline coverage) and g* (min relative loss). Even seeds: paired CI of loss(f*) - loss(g*). Also report Spearman rho between baseline coverage and relative loss across formations.",
    support: `f* differs from g* AND confirmation CI lower bound of loss(f*) - loss(g*) > ${MIN_EFFECT_LOSS}.`,
    contradict: "f* = g*, or the CI includes 0 (no detectable resilience penalty for the coverage-optimal formation).",
    alternatives: ["Relative loss is partly a ratio artefact: higher baseline can mechanically allow larger relative loss.", "Result depends on which disturbance is chosen (single reference suite)."],
    limitations: ["One disturbance suite only; other disturbances could reorder formations.", "5 formations is a small candidate set; ranking statistics are crude."],
  },
  {
    id: "H3",
    title: "Tighter movement constraints lengthen/deepen performance loss",
    statement: "Lower agent top speed produces a larger relative coverage loss under the same disturbance than higher top speed (monotone trend).",
    variables: { independent: "top speed vMax (0.6x, 0.8x, 1.0x, 1.2x of default)", dependent: "relative integrated coverage loss", controls: "formation, disturbance suite, seeds" },
    experiment: "Same seeds at four speeds; paired difference between slowest and fastest; Spearman correlation of mean loss with speed across the four levels.",
    support: `paired CI lower bound of loss(slowest) - loss(fastest) > ${MIN_EFFECT_LOSS} AND Spearman rho <= -0.8.`,
    contradict: "CI includes 0, or loss is not decreasing with speed (for example because baseline coverage also rises with speed, shrinking the ratio base).",
    alternatives: ["Speed changes baseline coverage itself, so loss is not a pure 'recovery' effect.", "Acceleration and reaction time may dominate at this scale."],
    limitations: ["Four levels only; threshold/non-linear behaviour between levels is invisible.", "Kinematic model ignores fatigue."],
  },
  {
    id: "H4",
    title: "Combined disturbances are worse than any single disturbance",
    statement: "A simultaneous combination of three disturbances causes larger integrated coverage loss than the worst of its three components.",
    variables: { independent: "scenario: each single disturbance vs the combination", dependent: "integrated coverage loss (mean over horizon after onset)", controls: "same seeds / same onset and duration" },
    experiment: "Paired comparison per seed of loss(combined) - max single loss; fraction of seeds where combined is worse; interaction = combined - sum of singles (exploratory).",
    support: "paired CI lower bound > 0 AND combined worse in >= 90% of seeds.",
    contradict: "CI includes 0 or fraction < 90%.",
    alternatives: ["Combined may be dominated by one component (no real interaction).", "Sub-additivity (combined < sum) may appear because disturbances overlap in space.", "In the reference suite the demand spike and the blocked region are CO-LOCATED (u=0.25 vs 0.3): demand inside an unreachable region cannot be served. A large combined effect may therefore reflect geometry of this particular suite, not a general law."],
    limitations: ["Specific locations/severities; other combinations unexplored (see Monte Carlo)."],
  },
  {
    id: "H5",
    title: "Nominal optimisation is not robust optimisation",
    statement: "A layout optimised only for nominal coverage keeps less coverage under HELD-OUT disturbances than a layout optimised for worst-case single-agent failure, at some nominal cost.",
    variables: { independent: "optimisation objective (nominal vs worst-case)", dependent: "static double-failure coverage; dynamic coverage under random held-out disturbance sets", controls: "start formation, constraints, iterations, held-out seeds" },
    experiment: "Simulated annealing for both objectives; evaluate on double failures and foci never used in optimisation, plus dynamic simulations with randomly generated disturbance sets.",
    support: "Robust layout has higher mean double-failure coverage AND the dynamic paired CI (robust - nominal) lower bound > 0.",
    contradict: "Neither measure favours the robust layout (nominal optimum already robust).",
    alternatives: ["SA may not have converged (heuristic); differences could be search noise.", "Robustness to agent failure may not transfer to other disturbance types."],
    limitations: ["Short SA runs; no claim of global optimum.", "Dynamic check uses 12 random sets only."],
  },
];

const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const argmax = (a: number[]) => a.indexOf(Math.max(...a));
const argmin = (a: number[]) => a.indexOf(Math.min(...a));
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

export async function runHypothesis(id: string, b: HypBase, onProgress?: Progress): Promise<HypothesisResult> {
  const env = getEnvironment(b.mode, b.layoutId);
  const forms = formationsFor(b.mode);
  const N = Math.max(8, b.trials);
  const seeds = Array.from({ length: N }, (_, k) => hashSeed(b.seed, k));
  const odd = seeds.map((_, k) => k).filter((k) => k % 2 === 1), even = seeds.map((_, k) => k).filter((k) => k % 2 === 0);
  const pick = (arr: number[], idx: number[]) => idx.map((i) => arr[i]);
  const base = { mode: b.mode, layoutId: b.layoutId, params: b.params, seed: b.seed, gridScale: 0.75 };
  const horizon = b.params.duration;
  const out = (verdict: Verdict, evidence: string[], headers: string[], rows: (string | number)[][]): HypothesisResult => ({ id, verdict, evidence, table: { headers, rows }, trials: N, hash: stableHash({ id, verdict, rows }), mode: b.mode });
  const combined = referenceSuite(env).combined;

  if (id === "H1") {
    const cov: number[][] = [];
    for (let f = 0; f < forms.length; f++) {
      cov.push([]);
      for (let k = 0; k < N; k++) cov[f].push(avgSeries(runSimulation({ env, formation: forms[f], params: b.params, seed: seeds[k], disturbances: [], gridScale: 0.75 }).series, "coverage"));
      onProgress?.(f + 1, forms.length, forms[f].name);
      await tick();
    }
    const selMean = cov.map((c) => mean(pick(c, odd)));
    const best = argmax(selMean), worst = argmin(selMean);
    const p = paired(pick(cov[best], even), pick(cov[worst], even));
    const verdict: Verdict = p.lo > MIN_EFFECT_COVERAGE ? "SUPPORTED" : p.excludesZero && p.mean > 0 ? "INCONCLUSIVE" : "NOT SUPPORTED";
    return out(verdict, [
      `Selection set (odd seeds): best = ${forms[best].name}, worst = ${forms[worst].name}.`,
      `Confirmation set (even seeds, n=${even.length}): mean(best - worst) = ${fmt(p.mean)} coverage units, 95% CI [${fmt(p.lo)}, ${fmt(p.hi)}], d_z = ${fmt(p.dz, 2)}.`,
      `Pre-registered minimum meaningful effect = ${MIN_EFFECT_COVERAGE}. CI lower bound ${p.lo > MIN_EFFECT_COVERAGE ? "exceeds" : "does not exceed"} it.`,
    ], ["Formation", "Mean coverage (all seeds)", "SD", "95% CI"], forms.map((f, i) => { const s = summarize(cov[i]); return [f.name, fmt(s.mean), fmt(s.sd), `[${fmt(s.lo)}, ${fmt(s.hi)}]`]; }));
  }

  if (id === "H2" || id === "H3") {
    const variants: { label: string; formation: Formation; params: SimParams }[] =
      id === "H2" ? forms.map((f) => ({ label: f.name, formation: f, params: b.params })) : [0.6, 0.8, 1, 1.2].map((m) => ({ label: `vMax x${m} (${fmt(b.params.vMax * m, 2)} m/s)`, formation: forms[0], params: { ...b.params, vMax: b.params.vMax * m } }));
    const baseCov: number[][] = [], loss: number[][] = [], rec: number[] = [];
    for (let v = 0; v < variants.length; v++) {
      baseCov.push([]);
      loss.push([]);
      let r = 0;
      for (let k = 0; k < N; k++) {
        const { baseline, disturbed, win } = runPair({ ...base, formation: variants[v].formation, params: variants[v].params }, combined, seeds[k]);
        const rc = resilienceOf(baseline.series, disturbed.series, "coverage", win, horizon);
        const ref = win ? avgSeries(baseline.series, "coverage", win.onset) : 1;
        baseCov[v].push(avgSeries(baseline.series, "coverage"));
        loss[v].push(ref > 0 ? rc.meanLoss / ref : 0);
        if (rc.recoveryTime !== null) r++;
      }
      rec.push(r / N);
      onProgress?.(v + 1, variants.length, variants[v].label);
      await tick();
    }
    const rows = variants.map((v, i) => [v.label, fmt(mean(baseCov[i])), fmt(mean(loss[i]), 4), `${(rec[i] * 100).toFixed(0)}%`]);
    const headers = ["Variant", "Baseline coverage", "Relative integrated loss", "Recovered within horizon"];
    if (id === "H2") {
      const fStar = argmax(baseCov.map((c) => mean(pick(c, odd)))), gStar = argmin(loss.map((c) => mean(pick(c, odd))));
      const rho = spearman(baseCov.map((c) => mean(c)), loss.map((c) => mean(c)));
      if (fStar === gStar) return out("NOT SUPPORTED", [`Odd seeds: coverage-best and resilience-best are the SAME formation (${variants[fStar].label}).`, `Spearman rho(baseline coverage, relative loss) across formations = ${fmt(rho, 2)}.`], headers, rows);
      const p = paired(pick(loss[fStar], even), pick(loss[gStar], even));
      const verdict: Verdict = p.lo > MIN_EFFECT_LOSS ? "SUPPORTED" : p.excludesZero && p.mean > 0 ? "INCONCLUSIVE" : "NOT SUPPORTED";
      return out(verdict, [
        `Coverage-best f* = ${variants[fStar].label}; resilience-best g* = ${variants[gStar].label} (selected on odd seeds).`,
        `Confirmation (even seeds): mean[loss(f*) - loss(g*)] = ${fmt(p.mean, 4)}, 95% CI [${fmt(p.lo, 4)}, ${fmt(p.hi, 4)}], f* worse in ${(p.fracPositive * 100).toFixed(0)}% of seeds.`,
        `Spearman rho(baseline coverage, relative loss) across formations = ${fmt(rho, 2)} (n=${variants.length} formations; crude).`,
      ], headers, rows);
    }
    const idxSlow = 0, idxFast = variants.length - 1;
    const p = paired(loss[idxSlow], loss[idxFast]);
    const rho = spearman(variants.map((_, i) => 0.6 + i * 0.2 + (i === 3 ? 0 : 0)), loss.map((c) => mean(c)));
    const verdict: Verdict = p.lo > MIN_EFFECT_LOSS && rho <= -0.8 ? "SUPPORTED" : p.excludesZero && p.mean > 0 ? "INCONCLUSIVE" : "NOT SUPPORTED";
    return out(verdict, [
      `Paired mean[loss(slowest) - loss(fastest)] = ${fmt(p.mean, 4)}, 95% CI [${fmt(p.lo, 4)}, ${fmt(p.hi, 4)}] (n=${N}).`,
      `Spearman rho(speed, mean relative loss) across 4 levels = ${fmt(rho, 2)}.`,
      p.mean < 0 ? "Direction is OPPOSITE to the hypothesis: slower agents lost proportionally LESS. Plausible explanation (HYPOTHESIZED, not tested): slow agents have lower baseline coverage, so there is less to lose." : "Direction agrees with the hypothesis.",
    ], headers, rows);
  }

  if (id === "H4") {
    const r = await compareScenarios({ ...base, formation: forms[0], disturbances: combined, trials: N }, onProgress);
    const ip = r.interaction;
    if (!ip || !ip.combinedVsMaxSingle) return out("INCONCLUSIVE", ["Not enough disturbances enabled."], ["Scenario"], []);
    const p = ip.combinedVsMaxSingle;
    const verdict: Verdict = p.lo > 0 && p.fracPositive >= 0.9 ? "SUPPORTED" : p.excludesZero && p.mean > 0 ? "INCONCLUSIVE" : "NOT SUPPORTED";
    return out(verdict, [
      `Combined worse than the worst single in ${(p.fracPositive * 100).toFixed(0)}% of ${N} seeds.`,
      `Paired mean[combined - max single] = ${fmt(p.mean, 4)}, 95% CI [${fmt(p.lo, 4)}, ${fmt(p.hi, 4)}].`,
      `Exploratory interaction: mean[combined - sum of singles] = ${fmt(ip.combinedMinusSum?.mean ?? NaN, 4)} (negative => sub-additive, positive => super-additive).`,
    ], ["Scenario", "Mean integrated coverage loss", "95% CI"], r.scenarios.map((s) => [s.label, fmt(s.meanLoss.mean, 4), `[${fmt(s.meanLoss.lo, 4)}, ${fmt(s.meanLoss.hi, 4)}]`]));
  }

  // H5
  const rs = await robustStudy({ env, params: b.params, formation: forms[0], seed: b.seed, iters: 300 }, (d, t, l) => onProgress?.(d, t + N * 2, l));
  const nom = rs.rows[1], rob = rs.rows[2];
  const W = env.width, H = env.height;
  const asF = (name: string, ps: typeof nom.positions): Formation => ({ id: name, name, description: "optimised", positions: ps.map((p, i) => ({ role: forms[0].positions[i].role, u: p.x / W, v: p.y / H })) });
  const fNom = asF("nominal-opt", nom.positions), fRob = asF("robust-opt", rob.positions);
  const dn: number[] = [], dr: number[] = [];
  for (let k = 0; k < N; k++) {
    const ds = randomDisturbanceSet(hashSeed(b.seed, k, 5150), env, fNom.positions.length, ["agent_unavailable", "region_blocked", "demand_spike", "movement_slowdown"], 0.6);
    for (const [f, arr] of [[fNom, dn], [fRob, dr]] as const)
      arr.push(avgSeries(runSimulation({ env, formation: f, params: b.params, seed: seeds[k], disturbances: ds, gridScale: 0.75 }).series, "coverage"));
    onProgress?.(rs.rows.length + k, rs.rows.length + N, "dynamic held-out check");
    if (k % 3 === 2) await tick();
  }
  const p = paired(dr, dn);
  const staticBetter = rob.doubleFailMean > nom.doubleFailMean;
  const dynBetter = p.lo > 0;
  const verdict: Verdict = staticBetter && dynBetter ? "SUPPORTED" : staticBetter || dynBetter ? "INCONCLUSIVE" : "NOT SUPPORTED";
  return out(verdict, [
    `Static held-out double failures: robust ${fmt(rob.doubleFailMean)} vs nominal ${fmt(nom.doubleFailMean)} (mean coverage).`,
    `Nominal (no failure) coverage: nominal-opt ${fmt(nom.nominal)} vs robust-opt ${fmt(rob.nominal)} (cost of robustness = ${fmt(nom.nominal - rob.nominal)}).`,
    `Dynamic held-out disturbance sets (n=${N}): mean[robust - nominal] disturbed coverage = ${fmt(p.mean, 4)}, 95% CI [${fmt(p.lo, 4)}, ${fmt(p.hi, 4)}].`,
    "SA is heuristic: neither layout is claimed globally optimal.",
  ], ["Layout", "Nominal", "Single-failure worst", "Double-failure mean", "Double-failure worst"], rs.rows.map((r) => [r.label, fmt(r.nominal), fmt(r.singleFailWorst), fmt(r.doubleFailMean), fmt(r.doubleFailWorst)]));
}
