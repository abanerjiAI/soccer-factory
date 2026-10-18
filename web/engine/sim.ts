/**
 * LEVEL 3 — dynamic agent model. Deterministic given (config, seed): all randomness enters through `seed`
 * via pure functions (hopTarget, opponentPositions) so baseline and disturbed runs share common random numbers.
 */
import type { AgentState, Disturbance, Environment, Formation, Frame, MetricSample, SimEvent, SimParams, SimResult, Vec } from "./types";
import { MODEL_VERSION, SOFTWARE_VERSION } from "./types";
import { SpatialModel, rasterCircles } from "./spatial";
import type { FieldResult } from "./spatial";
import { hopTarget, opponentPositions } from "./environments";
import { resolveActive } from "./disturbances";
import { stableHash } from "./rng";

export interface SimConfig {
  env: Environment;
  formation: Formation;
  params: SimParams;
  seed: number;
  disturbances: Disturbance[];
  recordFrames?: boolean;
  recordFields?: boolean;
  gridScale?: number;
}

/** Research question each behaviour allows us to ask (Level 3 requirement). */
export const BEHAVIOUR_REGISTRY = [
  { id: "role", name: "Role-based home positions", implemented: true, question: "Does the formation (home layout) alone determine coverage?" },
  { id: "speed", name: "Speed limit", implemented: true, question: "How does a movement constraint change coverage and recovery?" },
  { id: "accel", name: "Acceleration limit", implemented: true, question: "Does ramp-up time (not only top speed) limit response?" },
  { id: "radius", name: "Distance / formation-radius constraint", implemented: true, question: "How far may agents leave their assigned zone before structure is lost?" },
  { id: "collision", name: "Collision avoidance (hard separation)", implemented: true, question: "Does physical separation change coverage or congestion?" },
  { id: "repulsion", name: "Teammate repulsion (potential field, spacing)", implemented: true, question: "Does spacing behaviour reduce redundant coverage?" },
  { id: "attraction", name: "Demand attraction (potential field toward unserved demand)", implemented: true, question: "Does reactive repositioning shrink dead zones, and at what movement cost?" },
  { id: "ball", name: "Ball / focus response", implemented: true, question: "How strongly should the team shift with the demand focus?" },
  { id: "opponent", name: "Opponent response (indirect, through demand field)", implemented: true, question: "Do opponent-generated demand sources shift optimal positions?" },
  { id: "flocking", name: "Flocking / velocity alignment (off by default)", implemented: true, question: "Does moving as a connected group (matching teammates' velocity) smooth the block's response, and what coverage does it cost?" },
  { id: "tactical", name: "Tactical state machine: press / hold / drop (off by default)", implemented: true, question: "Do discrete modes (whole block pushes up or drops back with the ball) beat continuous response, and do they hurt recovery after a disturbance?" },
];

export function runSimulation(cfg: SimConfig): SimResult {
  const { env, formation, seed } = cfg;
  const P: SimParams = cfg.params;
  const W = env.width, H = env.height;
  const model = new SpatialModel(env, P, cfg.gridScale ?? 1);
  const g = model.grid;
  const N = formation.positions.length;

  let repaired = 0;
  const base: Vec[] = formation.positions.map((s) => {
    const r = model.snapFree({ x: Math.min(W, Math.max(0, s.u * W)), y: Math.min(H, Math.max(0, s.v * H)) });
    if (r.moved) repaired++;
    return r.p;
  });
  const roles = formation.positions.map((s) => s.role);
  const px = Float64Array.from(base.map((b) => b.x)), py = Float64Array.from(base.map((b) => b.y));
  const vx = new Float64Array(N), vy = new Float64Array(N), ax = new Float64Array(N), ay = new Float64Array(N);
  const attr = base.map(() => ({ x: 0, y: 0, s: 0 }));

  const steps = Math.round(P.duration / P.dt);
  const every = Math.max(1, Math.round(P.metricEvery / P.dt));
  let focus: Vec = { ...env.focusStart };
  let hop = 0;
  let target = hopTarget(env, seed, 0);
  let hopTimer = 0;
  const series: MetricSample[] = [];
  const frames: Frame[] = [];
  const events: SimEvent[] = [];
  if (repaired) events.push({ t: 0, text: `${repaired} formation slot(s) moved out of restricted areas (constraint repair).` });
  let last: FieldResult | null = null;
  let dynMask: Uint8Array | null = null;
  let dynSig = "";
  let prevSig = "";
  const deadCount = new Int32Array(g.n), curRun = new Int32Array(g.n), maxRun = new Int32Array(g.n);
  let samples = 0;
  const done = new Set<string>();
  let maxSpeed = 0, maxAcc = 0;
  const avail = new Array<boolean>(N).fill(true);
  const sm = new Array<number>(N).fill(1);
  let activeBlocked: { x: number; y: number; r: number }[] = [];
  let opps: Vec[] = [];
  const R = 0.3 * Math.min(W, H);
  let tacState: "press" | "hold" | "drop" = "hold";
  const tacOn = !!P.tactical && (P.tacticalShift ?? 0) > 0 && env.mode === "soccer";
  const align = P.alignment ?? 0;

  for (let k = 0; k <= steps; k++) {
    const t = k * P.dt;
    const act = resolveActive(cfg.disturbances, t, env);
    for (const d of cfg.disturbances) {
      if (d.enabled && d.type === "focus_relocation" && !done.has(d.id) && t >= d.start - 1e-9) {
        done.add(d.id);
        focus = { x: d.u * W, y: d.v * H };
        events.push({ t, text: `${env.vocab.focus} relocated to (${focus.x.toFixed(0)}, ${focus.y.toFixed(0)}) m.` });
      }
    }
    if (k > 0) {
      const step = P.focusSpeed * act.tempo * P.dt;
      const dd = Math.hypot(target.x - focus.x, target.y - focus.y);
      if (dd <= step) focus = { ...target };
      else focus = { x: focus.x + ((target.x - focus.x) / dd) * step, y: focus.y + ((target.y - focus.y) / dd) * step };
      hopTimer += P.dt * act.tempo;
      if (hopTimer >= P.focusHopEvery) {
        hop++;
        target = hopTarget(env, seed, hop);
        hopTimer = 0;
      }
    }
    opps = opponentPositions(env, focus, t, seed, P);
    const bsig = act.blocked.map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)},${b.r.toFixed(2)}`).join("|");
    if (bsig !== dynSig) {
      dynSig = bsig;
      dynMask = act.blocked.length ? rasterCircles(g, act.blocked) : null;
    }
    activeBlocked = act.blocked;
    for (let i = 0; i < N; i++) {
      avail[i] = !act.unavailable.has(i);
      let m = 1;
      for (const s of act.slow) if (Math.hypot(px[i] - s.x, py[i] - s.y) <= s.r) m *= s.mult;
      sm[i] = m;
    }
    const sig = `${[...act.unavailable].sort().join(",")}#${bsig}#${act.spikes.length}#${act.slow.length}#${act.tempo.toFixed(2)}`;
    if (sig !== prevSig) {
      if (k > 0 || sig !== "#" + "#0#0#1.00") {
        const parts: string[] = [];
        if (act.unavailable.size) parts.push(`${act.unavailable.size} ${env.vocab.agent}(s) unavailable`);
        if (act.blocked.length) parts.push(`${act.blocked.length} region(s) inaccessible`);
        if (act.spikes.length) parts.push(`${act.spikes.length} demand spike(s)`);
        if (act.slow.length) parts.push(`${act.slow.length} slowdown zone(s)`);
        if (act.tempo !== 1) parts.push(`tempo x${act.tempo.toFixed(2)}`);
        events.push({ t, text: parts.length ? `Active: ${parts.join(", ")}.` : "All disturbances ended." });
      }
      prevSig = sig;
    }

    if (k % every === 0) {
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (avail[i]) idx.push(i);
      const res = model.evaluate({
        agents: idx.map((i) => ({ x: px[i], y: py[i] })),
        speedMult: idx.map((i) => sm[i]),
        focus,
        opponents: opps,
        spikes: act.spikes,
        dynBlocked: dynMask,
      });
      last = res;
      let ms = 0;
      idx.forEach((i) => (ms += Math.hypot(vx[i], vy[i])));
      series.push({ t, ...res.metrics, activeAgents: idx.length, meanSpeed: idx.length ? ms / idx.length : 0 });
      samples++;
      for (let c = 0; c < g.n; c++) {
        if (res.dead[c]) {
          deadCount[c]++;
          curRun[c]++;
          if (curRun[c] > maxRun[c]) maxRun[c] = curRun[c];
        } else curRun[c] = 0;
      }
      // spatial response: cache the unserved-demand centroid each agent is attracted to
      for (let i = 0; i < N; i++) {
        let sw = 0, sx = 0, sy = 0;
        if (avail[i] && P.demandAttraction > 0) {
          const inv = 1 / (2 * R * R);
          for (let c = 0; c < g.n; c++) {
            const w = res.access[c] * Math.exp(-((g.cx[c] - px[i]) ** 2 + (g.cy[c] - py[i]) ** 2) * inv);
            sw += w;
            sx += w * g.cx[c];
            sy += w * g.cy[c];
          }
        }
        attr[i] = sw > 0 ? { x: sx / sw, y: sy / sw, s: Math.min(1, sw / (0.05 * Math.max(res.metrics.totalDemand, 1e-9))) } : { x: 0, y: 0, s: 0 };
      }
      if (cfg.recordFrames) {
        const f: Frame = {
          t,
          A: Array.from({ length: N * 2 }, (_, q) => (q % 2 === 0 ? px[q >> 1] : py[q >> 1])),
          B: opps.flatMap((o) => [o.x, o.y]),
          focus: [focus.x, focus.y],
          avail: [...avail],
          blocked: activeBlocked,
        };
        if (cfg.recordFields) {
          f.cov = Float32Array.from(res.cov);
          f.demand = Float32Array.from(res.demand);
          f.dead = Uint8Array.from(res.dead);
          f.bott = Float32Array.from(res.bott);
          f.access = Float32Array.from(res.access);
        }
        frames.push(f);
      }
    }
    if (k === steps) break;

    // ---- tactical state (hysteresis band of 3% of the pitch length) ----
    let tacShift = 0;
    if (tacOn) {
      const u = focus.x / W;
      const band = 0.03;
      const next: "press" | "hold" | "drop" = tacState === "press" ? (u < 0.62 - band ? "hold" : "press") : tacState === "drop" ? (u > 0.33 + band ? "hold" : "drop") : u > 0.62 ? "press" : u < 0.33 ? "drop" : "hold";
      if (next !== tacState) {
        tacState = next;
        events.push({ t, text: `Tactical state -> ${tacState.toUpperCase()}.` });
      }
      tacShift = tacState === "press" ? (P.tacticalShift as number) : tacState === "drop" ? -(P.tacticalShift as number) : 0;
    }

    // ---- control + integration ----
    for (let i = 0; i < N; i++) {
      if (!avail[i]) {
        vx[i] = vy[i] = ax[i] = ay[i] = 0;
        continue;
      }
      const gain = env.roleGain[roles[i]] ?? 0.3;
      const hx = base[i].x + (roles[i] === "GK" ? 0 : tacShift) + P.ballResponse * gain * (focus.x - base[i].x);
      const hy = base[i].y + P.ballResponse * gain * (focus.y - base[i].y);
      let ox = P.demandAttraction * attr[i].s * (attr[i].x - hx);
      let oy = P.demandAttraction * attr[i].s * (attr[i].y - hy);
      if (attr[i].s === 0) ox = oy = 0;
      for (let j = 0; j < N; j++) {
        if (j === i || !avail[j]) continue;
        const dx = px[i] - px[j], dy = py[i] - py[j];
        const d = Math.hypot(dx, dy);
        if (d < P.minSpacing) {
          const push = (P.minSpacing - d) * P.repulsion * 0.5;
          if (d > 1e-6) {
            ox += (dx / d) * push;
            oy += (dy / d) * push;
          } else ox += push * (i < j ? 1 : -1);
        }
      }
      if (align > 0) {
        let sx = 0, sy = 0, cnt = 0;
        for (let j = 0; j < N; j++) {
          if (j === i || !avail[j]) continue;
          if (Math.hypot(px[i] - px[j], py[i] - py[j]) <= 3 * P.minSpacing) { sx += vx[j]; sy += vy[j]; cnt++; }
        }
        if (cnt) { ox += align * (sx / cnt); oy += align * (sy / cnt); }
      }
      const om = Math.hypot(ox, oy);
      if (om > P.formationRadius) {
        ox *= P.formationRadius / om;
        oy *= P.formationRadius / om;
      }
      let tx = Math.min(W, Math.max(0, hx + ox)), ty = Math.min(H, Math.max(0, hy + oy));
      const here = model.cellOf(px[i], py[i]);
      if (dynMask && dynMask[here]) {
        const c = activeBlocked.find((b) => Math.hypot(px[i] - b.x, py[i] - b.y) <= b.r) ?? activeBlocked[0];
        const d = Math.hypot(px[i] - c.x, py[i] - c.y) || 1;
        tx = Math.min(W, Math.max(0, c.x + ((px[i] - c.x) / d) * (c.r + 1.5)));
        ty = Math.min(H, Math.max(0, c.y + ((py[i] - c.y) / d) * (c.r + 1.5)));
      } else if (!model.isFree(tx, ty, dynMask)) {
        tx = px[i];
        ty = py[i];
      }
      const vE = P.vMax * sm[i];
      const dx = tx - px[i], dy = ty - py[i];
      const dd = Math.hypot(dx, dy);
      const sp = dd < 1e-6 ? 0 : Math.min(vE, Math.sqrt(2 * P.aMax * dd));
      let ax_ = ((dd < 1e-6 ? 0 : (dx / dd) * sp) - vx[i]) / P.dt;
      let ay_ = ((dd < 1e-6 ? 0 : (dy / dd) * sp) - vy[i]) / P.dt;
      const am = Math.hypot(ax_, ay_);
      if (am > P.aMax) {
        ax_ *= P.aMax / am;
        ay_ *= P.aMax / am;
      }
      let nvx = vx[i] + ax_ * P.dt, nvy = vy[i] + ay_ * P.dt;
      const s2 = Math.hypot(nvx, nvy);
      if (s2 > vE) {
        nvx *= vE / s2;
        nvy *= vE / s2;
      }
      maxAcc = Math.max(maxAcc, Math.hypot(nvx - vx[i], nvy - vy[i]) / P.dt);
      maxSpeed = Math.max(maxSpeed, Math.hypot(nvx, nvy));
      ax[i] = (nvx - vx[i]) / P.dt;
      ay[i] = (nvy - vy[i]) / P.dt;
      let nx = px[i] + nvx * P.dt, ny = py[i] + nvy * P.dt;
      if (nx < 0 || nx > W) {
        nx = Math.min(W, Math.max(0, nx));
        nvx = 0;
      }
      if (ny < 0 || ny > H) {
        ny = Math.min(H, Math.max(0, ny));
        nvy = 0;
      }
      const nextBlocked = !model.isFree(nx, ny, dynMask);
      const hereBlocked = !!(model.staticMask[here] || (dynMask && dynMask[here]));
      if (nextBlocked && !hereBlocked) {
        nvx = nvy = 0;
        nx = px[i];
        ny = py[i];
      }
      vx[i] = nvx;
      vy[i] = nvy;
      px[i] = nx;
      py[i] = ny;
    }
    if (P.collisionAvoidance) {
      const minD = 2 * P.bodyRadius;
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          if (!avail[i] || !avail[j]) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const d = Math.hypot(dx, dy);
          if (d < minD) {
            const ux = d > 1e-9 ? dx / d : 1, uy = d > 1e-9 ? dy / d : 0;
            const m = (minD - d) / 2;
            if (model.isFree(px[i] - ux * m, py[i] - uy * m, dynMask)) {
              px[i] -= ux * m;
              py[i] -= uy * m;
            }
            if (model.isFree(px[j] + ux * m, py[j] + uy * m, dynMask)) {
              px[j] += ux * m;
              py[j] += uy * m;
            }
          }
        }
    }
  }

  const persistentMap = new Uint8Array(g.n), temporaryMap = new Uint8Array(g.n);
  let pA = 0, tA = 0;
  for (let c = 0; c < g.n; c++) {
    if (deadCount[c] === 0) continue;
    if (samples > 0 && deadCount[c] / samples >= 0.5 && maxRun[c] * P.metricEvery >= P.persistSeconds) {
      persistentMap[c] = 1;
      pA += g.cellArea;
    } else {
      temporaryMap[c] = 1;
      tA += g.cellArea;
    }
  }
  const finalState: AgentState[] = [];
  const tEnd = steps * P.dt;
  for (let i = 0; i < N; i++)
    finalState.push({ id: `A${i}`, team: "A", role: roles[i], x: px[i], y: py[i], vx: vx[i], vy: vy[i], ax: ax[i], ay: ay[i], available: avail[i], timestamp: tEnd });
  opps.forEach((o, j) => finalState.push({ id: `B${j}`, team: "B", role: "OPP", x: o.x, y: o.y, vx: 0, vy: 0, ax: 0, ay: 0, available: true, timestamp: tEnd }));

  return {
    series,
    frames,
    events,
    finalState,
    dead: { persistentArea: pA, temporaryArea: tA, persistentMap, temporaryMap },
    metadata: {
      modelVersion: MODEL_VERSION,
      softwareVersion: SOFTWARE_VERSION,
      seed,
      mode: env.mode,
      layoutId: env.layoutId,
      formation: formation.id,
      gridNx: g.nx,
      gridNy: g.ny,
      steps,
      maxObservedSpeed: maxSpeed,
      maxObservedAccel: maxAcc,
      repairedSlots: repaired,
    },
    hash: stableHash({ c: series.map((s) => s.coverage), f: series.map((s) => s.throughput), x: Array.from(px), y: Array.from(py) }),
  };
}

export const avgSeries = (s: MetricSample[], key: keyof MetricSample, from = 0, to = Infinity): number => {
  const v = s.filter((m) => m.t >= from && m.t <= to).map((m) => m[key] as number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};
