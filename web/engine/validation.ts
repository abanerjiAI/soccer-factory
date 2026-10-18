/**
 * Validation suite (Gate 3 / Section 29-30). Every case has an OBVIOUS expected behaviour derived from the mathematical model,
 * not merely "the code runs". Used by the in-app Validation page and by `npx tsx --test tests/engine.test.ts`.
 */
import type { Environment, Formation, SimParams } from "./types";
import { getEnvironment, SOCCER_FORMATIONS, FACILITY_FORMATIONS } from "./environments";
import { SpatialModel, rasterCircles } from "./spatial";
import { runSimulation, avgSeries } from "./sim";
import { accelerations, dist, speeds, travelTime } from "./geometry";
import { resilienceOf } from "./experiments";
import { resolveActive, makeDisturbance } from "./disturbances";
import { anneal, formationPositions, StaticEvaluator } from "./optimize";
import { paired, spearman, summarize } from "./stats";
import { applyH, invertH, solveHomography, validateCvPipeline } from "./cv";
import { computeIntro, defaultAgents, flowDistance, gridDistances, introGridFor, blockedMask } from "./intro";
import { parseMetricaCsv, speedProfile, suggestParams, syntheticTracking, toMetricaCsv } from "./tracking";

export interface ValidationCase {
  id: string;
  group: string;
  description: string;
  expected: string;
  observed: string;
  pass: boolean;
}

/** Constraint check for a formation (impossible configuration detection). Returns human-readable errors. */
export function validateFormation(env: Environment, f: Formation, minSpacing: number): string[] {
  const errs: string[] = [];
  const model = new SpatialModel(env, env.defaults, 1);
  f.positions.forEach((s, i) => {
    if (!(s.u >= 0 && s.u <= 1 && s.v >= 0 && s.v <= 1)) errs.push(`slot ${i}: (${s.u}, ${s.v}) outside the ${env.vocab.fieldName}`);
    else if (!model.isFree(s.u * env.width, s.v * env.height)) errs.push(`slot ${i}: inside a restricted area`);
  });
  for (let i = 0; i < f.positions.length; i++)
    for (let j = i + 1; j < f.positions.length; j++) {
      const d = Math.hypot((f.positions[i].u - f.positions[j].u) * env.width, (f.positions[i].v - f.positions[j].v) * env.height);
      if (d < minSpacing * 0.25) errs.push(`slots ${i} and ${j}: ${d.toFixed(2)} m apart (physically overlapping)`);
    }
  return errs;
}

const uniformEnv = (w = 100, h = 100, n = 50): Environment => ({ ...getEnvironment("soccer"), width: w, height: h, nx: n, ny: n, fixedSources: [], focusWeight: 0, opponents: [], baseWeight: 1, staticBlocked: [] });
const F = (a: number) => a.toFixed(4);

export async function runValidationSuite(onProgress?: (d: number, t: number) => void): Promise<ValidationCase[]> {
  const out: ValidationCase[] = [];
  const tests: [string, string, string, string, () => Promise<{ pass: boolean; observed: string }> | { pass: boolean; observed: string }][] = [];
  const T = (id: string, group: string, description: string, expected: string, fn: () => Promise<{ pass: boolean; observed: string }> | { pass: boolean; observed: string }) => tests.push([id, group, description, expected, fn]);
  const soc = getEnvironment("soccer"), fac = getEnvironment("facility", "linear");
  const P = soc.defaults;

  // ---------- Level 1: geometry
  T("G1", "Level 1 geometry", "Euclidean distance of a 3-4-5 triangle", "5", () => ({ pass: Math.abs(dist({ x: 0, y: 0 }, { x: 3, y: 4 }) - 5) < 1e-12, observed: String(dist({ x: 0, y: 0 }, { x: 3, y: 4 })) }));
  T("G2", "Level 1 geometry", "Agent moves twice as far in the same time => speed doubles", "ratio = 2", () => {
    const a = speeds([{ x: 0, y: 0 }, { x: 1, y: 0 }], [0, 1])[0], b = speeds([{ x: 0, y: 0 }, { x: 2, y: 0 }], [0, 1])[0];
    return { pass: Math.abs(b / a - 2) < 1e-12, observed: `v1=${a}, v2=${b}, ratio=${b / a}` };
  });
  T("G3", "Level 1 geometry", "Constant-velocity trajectory has zero acceleration", "|a| = 0", () => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ x: 2 * i, y: 0 }));
    const a = accelerations(pts, [0, 1, 2, 3, 4]);
    return { pass: a.every((v) => Math.abs(v) < 1e-12), observed: `max|a| = ${Math.max(...a)}` };
  });
  T("G4", "Level 1 geometry", "Travel time from rest: d=100 m, v=8, a=4 => 2 + 92/8 = 13.5 s; short hop d=2 => sqrt(2*2/4)=1 s", "13.5 s and 1.0 s", () => {
    const t1 = travelTime(100, 8, 4, 0), t2 = travelTime(2, 8, 4, 0);
    return { pass: Math.abs(t1 - 13.5) < 1e-9 && Math.abs(t2 - 1) < 1e-9, observed: `${t1}, ${t2}` };
  });

  // ---------- Level 2: coverage / capacity / bottleneck
  T("C1", "Level 2 coverage", "Known geometry: one agent at the centre of a 100x100 uniform field, v=2 m/s, instant acceleration, T*=10 s => hard coverage = pi R^2 / A with R=20 m", "0.1257 (+-5%)", () => {
    const e = uniformEnv();
    const p: SimParams = { ...e.defaults, vMax: 2, aMax: 1e9, reaction: 0, responseBudget: 10, totalDemand: 10 };
    const r = new SpatialModel(e, p).evaluate({ agents: [{ x: 50, y: 50 }], focus: { x: 50, y: 50 }, opponents: [] });
    const exp = (Math.PI * 400) / 10000;
    return { pass: Math.abs(r.metrics.hardCoverage - exp) / exp < 0.05, observed: `${F(r.metrics.hardCoverage)} vs analytic ${F(exp)}` };
  });
  T("C2", "Level 2 coverage", "Identical positions: 10 agents at one point have the SAME hard coverage as 1 agent, and lower soft coverage than a spread formation", "equal hard coverage; clustered < spread", () => {
    const m = new SpatialModel(soc, P), pt = { x: 40, y: 34 };
    const f0 = { x: 50, y: 34 }, op = soc.opponents;
    const one = m.evaluate({ agents: [pt], focus: f0, opponents: op }).metrics, ten = m.evaluate({ agents: Array(10).fill(pt), focus: f0, opponents: op }).metrics;
    const spread = m.evaluate({ agents: formationPositions(m, SOCCER_FORMATIONS[0]), focus: f0, opponents: op }).metrics.coverage;
    return { pass: Math.abs(one.hardCoverage - ten.hardCoverage) < 1e-9 && ten.coverage < spread, observed: `hard: ${F(one.hardCoverage)} vs ${F(ten.hardCoverage)}; soft clustered ${F(ten.coverage)} < spread ${F(spread)}` };
  });
  T("C3", "Level 2 coverage", "Zero-demand scenario: no NaN, throughput defined as 1 (nothing to serve), bottleneck 0", "finite; throughput=1; capacityLoss=0", () => {
    const m = new SpatialModel(soc, { ...P, totalDemand: 0 });
    const r = m.evaluate({ agents: formationPositions(m, SOCCER_FORMATIONS[0]), focus: { x: 50, y: 30 }, opponents: soc.opponents }).metrics;
    const finite = Object.values(r).every((v) => Number.isFinite(v));
    return { pass: finite && r.throughput === 1 && r.capacityLoss === 0, observed: `finite=${finite}, throughput=${r.throughput}, capacityLoss=${r.capacityLoss}` };
  });
  T("C4", "Level 2 coverage", "Removing an agent can never increase coverage", "coverage(9) <= coverage(10)", () => {
    const m = new SpatialModel(soc, P), pos = formationPositions(m, SOCCER_FORMATIONS[0]);
    const base = { focus: { x: 50, y: 30 }, opponents: soc.opponents };
    const c10 = m.evaluate({ agents: pos, ...base }).metrics.coverage, c9 = m.evaluate({ agents: pos.slice(1), ...base }).metrics.coverage;
    return { pass: c9 <= c10 + 1e-12, observed: `${F(c9)} <= ${F(c10)}` };
  });
  T("C5", "Level 2 coverage", "Blocked region: coverage inside blocked cells is 0 and global coverage does not increase", "cov(blocked cells)=0; coverage_blocked <= coverage_open", () => {
    const m = new SpatialModel(soc, P), pos = formationPositions(m, SOCCER_FORMATIONS[0]);
    const mask = rasterCircles(m.grid, [{ x: 30, y: 34, r: 12 }]);
    const base = { agents: pos, focus: { x: 50, y: 30 }, opponents: soc.opponents };
    const open = m.evaluate(base), blk = m.evaluate({ ...base, dynBlocked: mask });
    let maxIn = 0;
    mask.forEach((v, c) => { if (v) maxIn = Math.max(maxIn, blk.cov[c]); });
    return { pass: maxIn === 0 && blk.metrics.coverage <= open.metrics.coverage + 1e-12, observed: `max cov in blocked = ${maxIn}; ${F(blk.metrics.coverage)} <= ${F(open.metrics.coverage)}` };
  });
  const bnEnv = uniformEnv();
  const bnRun = (demand: number, cap = 10) => {
    const p: SimParams = { ...bnEnv.defaults, vMax: 2, aMax: 1e9, reaction: 0, responseBudget: 100, softness: 5, totalDemand: demand, capacityPerAgent: cap };
    return new SpatialModel(bnEnv, p).evaluate({ agents: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }], focus: { x: 50, y: 50 }, opponents: [] }).metrics;
  };
  T("B1", "Bottleneck", "Case A: low demand / high capacity (util 0.25)", "no bottleneck: capacityLoss = 0, elevation gain 0", () => {
    const m = bnRun(10);
    return { pass: m.capacityLoss < 1e-9 && m.elevationGain < 1e-9, observed: `util=${F(m.utilMax)}, capacityLoss=${F(m.capacityLoss)}` };
  });
  T("B2", "Bottleneck", "Case B: high demand, sufficient capacity (util 0.9): congestion rises but NOT a bottleneck", "queuePressure(B) > queuePressure(A) and capacityLoss = 0", () => {
    const a = bnRun(10), b = bnRun(36);
    return { pass: b.queuePressure > a.queuePressure && b.capacityLoss < 1e-9, observed: `queue ${F(a.queuePressure)} -> ${F(b.queuePressure)}, capacityLoss=${F(b.capacityLoss)}` };
  });
  T("B3", "Bottleneck", "Case C: high demand, constrained capacity (util 1.5) => loss fraction 1 - 40/60 = 0.333 and raising capacity 20% raises throughput", "capacityLoss ~ 0.333; elevation gain > 0", () => {
    const m = bnRun(60);
    return { pass: Math.abs(m.capacityLoss - 1 / 3) < 0.01 && m.elevationGain > 0.05, observed: `capacityLoss=${F(m.capacityLoss)}, gain=${F(m.elevationGain)}` };
  });
  T("B4", "Bottleneck", "Capacity decreases while demand is constant => throughput non-increasing, capacity loss non-decreasing", "monotone", () => {
    const caps = [20, 15, 10, 5], r = caps.map((c) => bnRun(60, c));
    const ok = r.every((m, i) => i === 0 || (m.throughput <= r[i - 1].throughput + 1e-12 && m.capacityLoss >= r[i - 1].capacityLoss - 1e-12));
    return { pass: ok, observed: r.map((m) => `${F(m.throughput)}/${F(m.capacityLoss)}`).join("  ") };
  });
  T("B5", "Bottleneck", "Conservation identity: throughput + capacityLoss + accessLoss = 1 at every sample of a dynamic run", "|sum - 1| < 1e-9", () => {
    const r = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[1], params: P, seed: 3, disturbances: [], gridScale: 0.75 });
    const worst = Math.max(...r.series.map((s) => Math.abs(s.throughput + s.capacityLoss + s.accessLoss - 1)));
    return { pass: worst < 1e-9, observed: `max deviation = ${worst.toExponential(2)}` };
  });
  T("D1", "Demand", "Demand field sums to totalDemand; a demand spike of severity 1 adds 60% in total", "sum = 100; with spike = 160", () => {
    const m = new SpatialModel(soc, P);
    const s0 = m.demandField({ x: 50, y: 30 }, soc.opponents).reduce((a, b) => a + b, 0);
    const s1 = m.demandField({ x: 50, y: 30 }, soc.opponents, [{ x: 20, y: 30, extra: 0.6, sigma: 6.8 }]).reduce((a, b) => a + b, 0);
    return { pass: Math.abs(s0 - 100) < 1e-6 && Math.abs(s1 - 160) < 1e-6, observed: `${s0.toFixed(3)}, ${s1.toFixed(3)}` };
  });

  T("D2", "Dead zones", "Persistence logic: a single immobile agent in a corner leaves distant demanded cells dead for the whole run => persistent area > 0; ten agents spread out leave less persistent area", "persistent(1 agent) > 0 and > persistent(10 agents)", () => {
    const p = { ...P, ballResponse: 0, demandAttraction: 0, repulsion: 0, duration: 30 };
    const one: Formation = { id: "one", name: "one", description: "", positions: [{ role: "DEF", u: 0.05, v: 0.05 }] };
    const a = runSimulation({ env: soc, formation: one, params: p, seed: 1, disturbances: [], gridScale: 0.75 }).dead;
    const b = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: p, seed: 1, disturbances: [], gridScale: 0.75 }).dead;
    return { pass: a.persistentArea > 0 && a.persistentArea > b.persistentArea, observed: `1 agent: ${a.persistentArea.toFixed(0)} m2 persistent; 10 agents: ${b.persistentArea.toFixed(0)} m2` };
  });

  // ---------- Level 3: dynamics
  T("M1", "Level 3 dynamics", "Stationary agents: no ball response, attraction, repulsion => agents stay at home with zero speed", "displacement = 0", () => {
    const p = { ...P, ballResponse: 0, demandAttraction: 0, repulsion: 0, collisionAvoidance: false, duration: 20 };
    const r = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: p, seed: 1, disturbances: [], gridScale: 0.6 });
    const m = new SpatialModel(soc, p, 0.6), home = formationPositions(m, SOCCER_FORMATIONS[0]);
    const dmax = Math.max(...r.finalState.filter((a) => a.team === "A").map((a, i) => Math.hypot(a.x - home[i].x, a.y - home[i].y)));
    return { pass: dmax < 1e-9, observed: `max displacement = ${dmax}` };
  });
  T("M2", "Level 3 dynamics", "Speed and acceleration limits are never exceeded (no disturbance)", "max speed <= vMax; max accel <= aMax", () => {
    const r = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: P, seed: 5, disturbances: [], gridScale: 0.6 });
    return { pass: r.metadata.maxObservedSpeed <= P.vMax + 1e-6 && r.metadata.maxObservedAccel <= P.aMax + 1e-6, observed: `v=${r.metadata.maxObservedSpeed.toFixed(3)} <= ${P.vMax}, a=${r.metadata.maxObservedAccel.toFixed(3)} <= ${P.aMax}` };
  });
  T("M3", "Level 3 dynamics", "Determinism: same seed => same hash; different seed => different hash", "equal / different", () => {
    const run = (s: number) => runSimulation({ env: soc, formation: SOCCER_FORMATIONS[2], params: { ...P, duration: 20 }, seed: s, disturbances: [], gridScale: 0.6 }).hash;
    const a = run(7), b = run(7), c = run(8);
    return { pass: a === b && a !== c, observed: `${a} ${b} ${c}` };
  });
  T("M4", "Level 3 dynamics", "Collision avoidance: two agents started at the same point end >= 2 x body radius apart; without avoidance they stay together", "separation >= 1.6 m (on) / 0 (off)", () => {
    const f: Formation = { id: "t", name: "t", description: "", positions: [{ role: "MID", u: 0.5, v: 0.5 }, { role: "MID", u: 0.5, v: 0.5 }] };
    const run = (on: boolean) => {
      const r = runSimulation({ env: soc, formation: f, params: { ...P, ballResponse: 0, demandAttraction: 0, repulsion: 0, collisionAvoidance: on, duration: 5 }, seed: 1, disturbances: [], gridScale: 0.6 });
      const [a, b] = r.finalState.filter((s) => s.team === "A");
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const on = run(true), off = run(false);
    return { pass: on >= 2 * P.bodyRadius - 1e-6 && off < 1e-9, observed: `on=${on.toFixed(3)} m, off=${off.toFixed(3)} m` };
  });
  T("M5", "Level 3 dynamics", "Impossible configurations are detected (slot outside field; slot inside a restricted area; valid formation passes)", "errors for the first two, none for the third", () => {
    const bad1: Formation = { id: "b1", name: "b1", description: "", positions: [{ role: "DEF", u: 1.4, v: 0.5 }] };
    const bad2: Formation = { id: "b2", name: "b2", description: "", positions: [{ role: "OP", u: 0.5, v: 0.2 }] };
    const e1 = validateFormation(soc, bad1, 8), e2 = validateFormation(fac, bad2, 4), e3 = validateFormation(soc, SOCCER_FORMATIONS[0], 8);
    return { pass: e1.length > 0 && e2.length > 0 && e3.length === 0, observed: `${e1.length}, ${e2.length}, ${e3.length} error(s)` };
  });

  // ---------- Level 5: disturbance & resilience
  T("R1", "Level 5 disturbance", "Disturbance windows: spike active only inside [start, start+duration)", "inactive, active, inactive", () => {
    const d = makeDisturbance("demand_spike", soc, { enabled: true, start: 20, duration: 10 });
    const n = (t: number) => resolveActive([d], t, soc).spikes.length;
    return { pass: n(19.9) === 0 && n(20) === 1 && n(29.9) === 1 && n(30) === 0, observed: `${n(19.9)}, ${n(20)}, ${n(29.9)}, ${n(30)}` };
  });
  T("R2", "Level 5 resilience", "No disturbance (or all disabled) => zero loss; identical series => recovery time 0", "peakLoss = 0, meanLoss = 0", () => {
    const r = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: P, seed: 2, disturbances: [], gridScale: 0.6 });
    const res = resilienceOf(r.series, r.series, "coverage", { onset: 20, end: 35 }, P.duration);
    return { pass: res.peakLoss === 0 && res.meanLoss === 0 && res.recoveryTime === 0, observed: `peak=${res.peakLoss}, mean=${res.meanLoss}, rec=${res.recoveryTime}` };
  });
  T("R3", "Level 5 resilience", "Three agents unavailable for 15 s => measurable coverage loss that is larger than for one agent, and the loss starts at onset", "loss(3) > loss(1) > 0", () => {
    const run = (agents: number[]) => {
      const d = makeDisturbance("agent_unavailable", soc, { enabled: true, agents, start: 20, duration: 15 });
      const b = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: P, seed: 4, disturbances: [], gridScale: 0.6 });
      const x = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: P, seed: 4, disturbances: [d], gridScale: 0.6 });
      return resilienceOf(b.series, x.series, "coverage", { onset: 20, end: 35 }, P.duration);
    };
    const r1 = run([5]), r3 = run([5, 6, 1]);
    return { pass: r3.meanLoss > r1.meanLoss && r1.meanLoss > 0, observed: `meanLoss(1)=${F(r1.meanLoss)}, meanLoss(3)=${F(r3.meanLoss)}` };
  });

  // ---------- Level 4: optimisation
  T("O1", "Level 4 optimisation", "Simulated annealing never returns a layout worse than its start, and satisfies bounds + spacing constraints", "best <= start; constraints satisfied", async () => {
    const ev = new StaticEvaluator(soc, P, { seed: 2 });
    const start = formationPositions(ev.model, SOCCER_FORMATIONS[0]);
    const r = await anneal({ start, f: (p) => -ev.evaluate(p).coverage, model: ev.model, minSpacing: P.minSpacing, iters: 150, seed: 3, step0: 8 });
    const inside = r.best.every((p) => ev.model.isFree(p.x, p.y));
    let minD = Infinity;
    r.best.forEach((p, i) => r.best.forEach((q, j) => { if (j > i) minD = Math.min(minD, dist(p, q)); }));
    return { pass: r.bestVal <= r.startVal + 1e-12 && inside && minD >= Math.min(P.minSpacing, 8) - 1e-9, observed: `coverage ${(-r.startVal).toFixed(4)} -> ${(-r.bestVal).toFixed(4)}; min spacing ${minD.toFixed(2)} m` };
  });

  // ---------- Level 11: facility
  T("F1", "Facility mode", "Same engine in facility mode: metrics finite, coverage in [0,1], restricted areas carry zero demand", "finite; 0<=cov<=1; demand in racks = 0", () => {
    const p = { ...fac.defaults, duration: 30 };
    const r = runSimulation({ env: fac, formation: FACILITY_FORMATIONS[0], params: p, seed: 1, disturbances: [], gridScale: 1 });
    const m = new SpatialModel(fac, p), D = m.demandField(fac.focusStart, []);
    let inRack = 0;
    m.staticMask.forEach((v, c) => { if (v) inRack += D[c]; });
    const ok = r.series.every((s) => Number.isFinite(s.coverage) && s.coverage >= 0 && s.coverage <= 1);
    return { pass: ok && inRack === 0, observed: `ok=${ok}, demand in restricted cells = ${inRack}` };
  });
  T("F2", "Facility mode", "Material-flow distance: linear in-line layout (5 legs x 9 m = 45 m) is shorter than the zig-zag functional layout", "linear ~ 45 m < functional", () => {
    const lin = new SpatialModel(getEnvironment("facility", "linear"), fac.defaults).flowCost().total, fn = new SpatialModel(getEnvironment("facility", "functional"), fac.defaults).flowCost().total;
    return { pass: Math.abs(lin - 45) / 45 < 0.06 && lin < fn, observed: `linear=${lin.toFixed(1)} m, functional=${fn.toFixed(1)} m` };
  });
  T("F3", "Facility mode", "Detour: a closed aisle makes path distance >= straight-line distance (never shorter)", "pathDist >= euclid", () => {
    const m = new SpatialModel(fac, fac.defaults), a = { x: 8, y: 20 };
    const open = m.distancesFrom(a, null), blocked = m.distancesFrom(a, m.combineMask(rasterCircles(m.grid, [{ x: 30, y: 20, r: 6 }])));
    let ok = true;
    for (let c = 0; c < m.grid.n; c++) if (blocked[c] < open[c] - 1e-9) ok = false;
    return { pass: ok, observed: ok ? "all cells satisfied" : "violation" };
  });

  // ---------- Statistics
  T("S1", "Statistics", "summarize([1..5]): mean 3, sd 1.5811, 95% t-interval half-width 2.776 x 1.5811 / sqrt(5) = 1.963", "mean 3; half-width 1.963", () => {
    const s = summarize([1, 2, 3, 4, 5]);
    return { pass: Math.abs(s.mean - 3) < 1e-12 && Math.abs(s.sd - 1.5811) < 1e-3 && Math.abs(s.hi - s.mean - 1.963) < 2e-3, observed: `mean=${s.mean}, sd=${s.sd.toFixed(4)}, hw=${(s.hi - s.mean).toFixed(3)}` };
  });
  T("S2", "Statistics", "Spearman rho of a perfectly monotone relation = 1; paired d_z for differences [1,2,3] = 2", "1 and 2", () => {
    const r = spearman([1, 2, 3, 4], [10, 20, 35, 80]), p = paired([2, 3, 4], [1, 1, 1]);
    return { pass: Math.abs(r - 1) < 1e-12 && Math.abs(p.dz - 2) < 1e-12, observed: `rho=${r}, dz=${p.dz}` };
  });

  // ---------- Computer vision (SYNTHETIC controlled data only)
  T("V1", "Computer vision", "Homography round trip: pixel -> field -> pixel returns the original pixel", "error < 1e-8 px", () => {
    const H = solveHomography([{ x: 70, y: 60 }, { x: 580, y: 48 }, { x: 610, y: 430 }, { x: 40, y: 420 }], [{ x: 0, y: 0 }, { x: 42, y: 0 }, { x: 42, y: 29.7 }, { x: 0, y: 29.7 }]);
    const p = { x: 300, y: 200 }, q = applyH(invertH(H), applyH(H, p));
    return { pass: Math.hypot(p.x - q.x, p.y - q.y) < 1e-8, observed: `${Math.hypot(p.x - q.x, p.y - q.y).toExponential(2)} px` };
  });
  T("V2", "Computer vision", "SYNTHETIC end-to-end: known marker positions rendered through a known camera with noise and imperfect corner clicks; all 11 markers detected in all frames; RMS position error < 0.5 cm (1.2% of the 42 cm sheet width)", "detected = expected; RMS < 0.5", () => {
    const v = validateCvPipeline(1, 10, 6).result;
    return { pass: v.detected === v.expected && v.rmsError < 0.5, observed: `detected ${v.detected}/${v.expected}; RMS = ${v.rmsError.toFixed(3)} cm; max = ${v.maxError.toFixed(3)} cm` };
  });

  // ---------- Start Here (rungs 1-2): reach and importance
  const startSoc = getEnvironment("soccer"), startFac = (id: string) => getEnvironment("facility", id);
  const socAgents = defaultAgents(startSoc, SOCCER_FORMATIONS[0].positions);
  const intro = (env: Environment, agents: { x: number; y: number }[], seconds: number, weighted = false, focus = { x: env.width / 2, y: env.height / 2 }) => computeIntro({ env, agents, focus, speed: 6, seconds, weighted });
  T("H1", "Start Here (reach, importance)", "Zero seconds to arrive => nothing is reached (coverage 0); radius = speed x seconds", "coverage 0; radius 18 m for 6 m/s x 3 s", () => {
    const a = intro(startSoc, socAgents, 0), b = intro(startSoc, socAgents, 3);
    return { pass: a.coverage === 0 && Math.abs(b.radius - 18) < 1e-12, observed: `coverage(0 s) = ${a.coverage}; radius(3 s) = ${b.radius}` };
  });
  T("H2", "Start Here (reach, importance)", "More time can never reduce coverage (monotone in seconds), pitch and factory floor", "non-decreasing", () => {
    const seq = (env: Environment, ag: { x: number; y: number }[]) => [0.5, 1, 2, 3, 4, 6, 8].map((t) => intro(env, ag, t).coverage);
    const ok = (v: number[]) => v.every((x, i) => i === 0 || x >= v[i - 1] - 1e-12);
    const sa = seq(startSoc, socAgents), fa = seq(startFac("ushape"), defaultAgents(startFac("ushape"), FACILITY_FORMATIONS[0].positions));
    return { pass: ok(sa) && ok(fa), observed: `pitch ${sa.map((x) => x.toFixed(2)).join(" ")} | floor ${fa.map((x) => x.toFixed(2)).join(" ")}` };
  });
  T("H3", "Start Here (reach, importance)", "One player in the middle of an empty open pitch with R = 20 m covers about pi R^2 / (105 x 68)", "0.176 (+-0.02, grid discretisation)", () => {
    const r = intro(startSoc, [{ x: 52.5, y: 34 }], 20 / 6);
    const exp = (Math.PI * 400) / (105 * 68);
    return { pass: Math.abs(r.coverage - exp) < 0.02, observed: `${r.coverage.toFixed(4)} vs analytic ${exp.toFixed(4)}` };
  });
  T("H4", "Start Here (reach, importance)", "Ten players bunched at one spot cover less than the same ten spread out (same radius)", "bunched < spread", () => {
    const bunched = Array.from({ length: 10 }, (_, i) => ({ x: 52 + (i % 3), y: 34 + (i % 2) }));
    const a = intro(startSoc, bunched, 3).coverage, b = intro(startSoc, socAgents, 3).coverage;
    return { pass: a < b, observed: `bunched ${a.toFixed(3)} < spread ${b.toFixed(3)}` };
  });
  T("H5", "Start Here (reach, importance)", "Removing a player never increases coverage", "coverage(9) <= coverage(10)", () => {
    const full = intro(startSoc, socAgents, 3).coverage;
    const worst = Math.max(...socAgents.map((_, i) => intro(startSoc, socAgents.filter((__, j) => j !== i), 3).coverage));
    return { pass: worst <= full + 1e-12, observed: `10 players ${full.toFixed(3)}; best 9-player case ${worst.toFixed(3)}` };
  });
  T("H6", "Start Here (reach, importance)", "Importance weighting: players all in their own half, ball deep in the attacking end => weighted coverage < plain coverage (the important spot is unprotected)", "weighted < plain", () => {
    const own = socAgents.map((p) => ({ x: p.x * 0.5, y: p.y }));
    const f = { x: 95, y: 34 };
    const plain = intro(startSoc, own, 3, false, f).coverage, w = intro(startSoc, own, 3, true, f).weightedCoverage;
    return { pass: w < plain, observed: `plain ${plain.toFixed(3)}, weighted ${w.toFixed(3)}` };
  });
  T("H7", "Start Here (reach, importance)", "Factory: walking path around a rack is longer than the straight line (U-shaped cell, S1 -> S5 across the central block), and never shorter", "straight < walk < 1.6 x straight", () => {
    const env = startFac("ushape"), { cs, nx, ny } = introGridFor(env), blocked = blockedMask(env, nx, ny, cs);
    const a = env.fixedSources.find((s) => s.id === "S1")!, b = env.fixedSources.find((s) => s.id === "S5")!;
    const d = gridDistances(nx, ny, cs, blocked, Math.floor(a.x / cs), Math.floor(a.y / cs));
    const walk = d[Math.floor(b.x / cs) + Math.floor(b.y / cs) * nx], straight = Math.hypot(a.x - b.x, a.y - b.y);
    return { pass: walk > straight && walk < 1.6 * straight, observed: `straight ${straight.toFixed(1)} m, walking ${walk.toFixed(1)} m` };
  });
  T("H8", "Start Here (reach, importance)", "Flow distance of every layout is at least the sum of straight-line leg lengths (a path can never beat a straight line)", "walk >= straight for all 3 layouts", () => {
    const rows = ["linear", "ushape", "functional"].map((id) => {
      const env = startFac(id);
      const by = new Map(env.fixedSources.map((s) => [s.id, s]));
      let straight = 0;
      for (let i = 0; i + 1 < env.flowRoute.length; i++) { const a = by.get(env.flowRoute[i])!, b = by.get(env.flowRoute[i + 1])!; straight += Math.hypot(a.x - b.x, a.y - b.y); }
      return { id, straight, walk: flowDistance(env) };
    });
    return { pass: rows.every((r) => r.walk >= r.straight - 1e-6), observed: rows.map((r) => `${r.id}: straight ${r.straight.toFixed(1)}, walk ${r.walk.toFixed(1)}`).join(" | ") };
  });

  // ---------- Behaviours added after the first release (both OFF by default)
  const bp: SimParams = { ...P, duration: 24, focusSpeed: 0 };
  const hold = (u: number, extra: Partial<SimParams>) => runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: { ...bp, ...extra }, seed: 5, disturbances: [makeDisturbance("focus_relocation", soc, { enabled: true, u, v: 0.5, start: 0 })] });
  const meanX = (r: ReturnType<typeof runSimulation>) => r.finalState.filter((a) => a.team === "A").reduce((s, a) => s + a.x, 0) / r.finalState.filter((a) => a.team === "A").length;
  T("X1", "Behaviours", "New switches off (or absent) leave the simulation bit-for-bit unchanged", "identical result hash", () => {
    const old: Record<string, unknown> = { ...P };
    delete old.alignment; delete old.tactical; delete old.tacticalShift;
    const a = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: { ...(old as unknown as SimParams), duration: 20 }, seed: 3, disturbances: [] }).hash;
    const b = runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: { ...P, alignment: 0, tactical: false, duration: 20 }, seed: 3, disturbances: [] }).hash;
    return { pass: a === b, observed: `${a} vs ${b}` };
  });
  T("X2", "Behaviours", "Tactical PRESS: ball held deep in the attacking third => the block ends up further forward than with tactics off; DROP: ball deep in own third => further back", "press: +x; drop: -x (> 2 m)", () => {
    const pOn = hold(0.9, { tactical: true }), pOff = hold(0.9, { tactical: false }), dOn = hold(0.1, { tactical: true }), dOff = hold(0.1, { tactical: false });
    const up = meanX(pOn) - meanX(pOff), down = meanX(dOff) - meanX(dOn);
    return { pass: up > 2 && down > 2, observed: `press moves block ${up.toFixed(1)} m forward; drop moves it ${down.toFixed(1)} m back` };
  });
  T("X3", "Behaviours", "Tactical state changes are logged as events (the state machine is observable)", "event 'PRESS' present", () => {
    const r = hold(0.9, { tactical: true });
    return { pass: r.events.some((e) => /PRESS/.test(e.text)), observed: r.events.map((e) => e.text).filter((t) => /Tactical/.test(t)).join("; ") || "none" };
  });
  T("X4", "Behaviours", "Alignment = 1 keeps every physical limit (speed <= vMax, acceleration <= aMax) and stays deterministic", "limits hold; same hash twice", () => {
    const run = () => runSimulation({ env: soc, formation: SOCCER_FORMATIONS[0], params: { ...P, alignment: 1, duration: 30 }, seed: 9, disturbances: [] });
    const r = run(), r2 = run();
    return { pass: r.metadata.maxObservedSpeed <= P.vMax + 1e-6 && r.metadata.maxObservedAccel <= P.aMax * 1.0001 + 1e-6 && r.hash === r2.hash, observed: `max speed ${r.metadata.maxObservedSpeed.toFixed(2)} (limit ${P.vMax}); max accel ${r.metadata.maxObservedAccel.toFixed(2)} (limit ${P.aMax})` };
  });

  // ---------- Real match data pipeline (checked on SYNTHETIC tracking with a known speed limit)
  const syn = syntheticTracking({ seed: 7, vTrue: 8, aTrue: 4, noise: 0.05, seconds: 90 });
  T("Q1", "Real data", "Writing tracking to Metrica CSV and parsing it back returns the same players and positions", "same count; error < 1 mm", () => {
    const parsed = parseMetricaCsv(toMetricaCsv(syn.tracking)).tracking!;
    let maxErr = 0;
    parsed.players.forEach((p, i) => { for (let k = 0; k < p.x.length; k += 7) maxErr = Math.max(maxErr, Math.abs(p.x[k] - syn.tracking.players[i].x[k]), Math.abs(p.y[k] - syn.tracking.players[i].y[k])); });
    return { pass: parsed.players.length === syn.tracking.players.length && parsed.fps === 25 && maxErr < 1e-3, observed: `${parsed.players.length} players, ${parsed.fps} fps, max error ${(maxErr * 1000).toFixed(2)} mm` };
  });
  T("Q2", "Real data", "The speed estimate recovers the known speed limit (8 m/s) to within 12% after smoothing", "|estimate - 8| / 8 < 0.12", () => {
    const sg = suggestParams(speedProfile(syn.tracking, 0.5));
    return { pass: !!sg && Math.abs(sg.vMax - 8) / 8 < 0.12, observed: sg ? `estimated vMax ${sg.vMax.toFixed(2)} m/s, aMax ${sg.aMax.toFixed(2)} m/s^2 (truth 8, 4)` : "no estimate" };
  });
  T("Q3", "Real data", "Differentiating noisy positions invents speed: no smoothing gives a much higher top-speed estimate than 0.5 s smoothing", "unsmoothed > 1.3 x smoothed", () => {
    const noisy = syntheticTracking({ seed: 7, vTrue: 8, aTrue: 4, noise: 0.15, seconds: 90 }).tracking;
    const raw = suggestParams(speedProfile(noisy, 0.04)), sm = suggestParams(speedProfile(noisy, 0.5));
    return { pass: !!raw && !!sm && raw.vMax > 1.3 * sm.vMax, observed: raw && sm ? `unsmoothed ${raw.vMax.toFixed(2)} vs smoothed ${sm.vMax.toFixed(2)} m/s` : "no estimate" };
  });
  T("Q4", "Real data", "Missing positions stay missing (not guessed) and are reported", "NaN kept; warning shown", () => {
    const csv = toMetricaCsv(syn.tracking).split("\n");
    const cells = csv[10].split(","); cells[3] = "NaN"; cells[4] = "NaN"; csv[10] = cells.join(","); // frame 8, first player
    const r = parseMetricaCsv(csv.join("\n"));
    return { pass: !!r.tracking && Number.isNaN(r.tracking.players[0].x[7]) && r.warnings.some((w) => /missing/i.test(w)), observed: r.warnings.join(" ") || "no warning" };
  });

  for (let i = 0; i < tests.length; i++) {
    const [id, group, description, expected, fn] = tests[i];
    try {
      const r = await fn();
      out.push({ id, group, description, expected, observed: r.observed, pass: r.pass });
    } catch (e) {
      out.push({ id, group, description, expected, observed: `EXCEPTION: ${(e as Error).message}`, pass: false });
    }
    onProgress?.(i + 1, tests.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  void avgSeries;
  return out;
}
