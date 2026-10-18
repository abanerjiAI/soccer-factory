/** LEVEL 5 — disturbances. A disturbance is a *recorded experimental condition*, not an animation. */
import type { Disturbance, DisturbanceType, Environment } from "./types";
import { mulberry32 } from "./rng";

export const DISTURBANCE_TYPES: { type: DisturbanceType; usesLocation: boolean; usesSeverity: boolean; usesAgents: boolean; instantaneous: boolean; meaning: string }[] = [
  { type: "focus_relocation", usesLocation: true, usesSeverity: false, usesAgents: false, instantaneous: true, meaning: "The primary demand focus jumps to a new location at the start time (ball relocation / priority job moved)." },
  { type: "agent_unavailable", usesLocation: false, usesSeverity: false, usesAgents: true, instantaneous: false, meaning: "Selected agents cannot move or serve for the duration (resource failure). Severity = number of agents selected." },
  { type: "region_blocked", usesLocation: true, usesSeverity: true, usesAgents: false, instantaneous: false, meaning: "A circular region becomes inaccessible to agents (radius grows with severity). Demand there remains but cannot be reached." },
  { type: "demand_spike", usesLocation: true, usesSeverity: true, usesAgents: false, instantaneous: false, meaning: "Extra demand (up to +60% of nominal total at severity 1) concentrated around the location." },
  { type: "movement_slowdown", usesLocation: true, usesSeverity: true, usesAgents: false, instantaneous: false, meaning: "Agents inside a circle move at (1 - 0.6 x severity) of normal speed (opponent pressing / aisle congestion)." },
  { type: "tempo_increase", usesLocation: false, usesSeverity: true, usesAgents: false, instantaneous: false, meaning: "The focus relocates (1 + 1.5 x severity) times faster, raising movement demand." },
];

let counter = 0;
export function makeDisturbance(type: DisturbanceType, env: Environment, over: Partial<Disturbance> = {}): Disturbance {
  counter++;
  const p = env.defaults;
  return {
    id: `d${counter}`,
    type,
    enabled: false,
    severity: type === "agent_unavailable" ? 0.25 : 0.6,
    u: 0.3,
    v: 0.5,
    start: p.disturbanceStart,
    duration: type === "focus_relocation" ? 0 : p.disturbanceDuration,
    agents: type === "agent_unavailable" ? [5] : undefined,
    ...over,
  };
}

export function defaultDisturbanceMatrix(env: Environment): Disturbance[] {
  return DISTURBANCE_TYPES.map((d, i) =>
    makeDisturbance(d.type, env, {
      id: `m${i}`,
      u: d.type === "focus_relocation" ? 0.2 : d.type === "demand_spike" ? 0.25 : 0.4,
      v: 0.5,
    }),
  );
}

/** The fixed reference suite used by hypothesis tests H2-H4 (pre-registered, not tuned after seeing results). */
export function referenceSuite(env: Environment): { single: Disturbance[]; combined: Disturbance[] } {
  const p = env.defaults;
  const single = [
    makeDisturbance("agent_unavailable", env, { id: "ref-agent", enabled: true, agents: [5], start: p.disturbanceStart, duration: p.disturbanceDuration }),
    makeDisturbance("region_blocked", env, { id: "ref-region", enabled: true, severity: 0.6, u: env.mode === "soccer" ? 0.3 : 0.5, v: 0.5, start: p.disturbanceStart, duration: p.disturbanceDuration }),
    makeDisturbance("demand_spike", env, { id: "ref-spike", enabled: true, severity: 0.8, u: env.mode === "soccer" ? 0.25 : 0.5, v: 0.5, start: p.disturbanceStart, duration: p.disturbanceDuration }),
  ];
  return { single, combined: single };
}

export interface ActiveDisturbances {
  unavailable: Set<number>;
  blocked: { x: number; y: number; r: number }[];
  spikes: { x: number; y: number; extra: number; sigma: number }[];
  slow: { x: number; y: number; r: number; mult: number }[];
  tempo: number;
}

const isActive = (d: Disturbance, t: number) => d.enabled && t >= d.start - 1e-9 && t < d.start + Math.max(d.duration, 0) - 1e-9;

export function resolveActive(ds: Disturbance[], t: number, env: Environment): ActiveDisturbances {
  const m = Math.min(env.width, env.height);
  const out: ActiveDisturbances = { unavailable: new Set(), blocked: [], spikes: [], slow: [], tempo: 1 };
  for (const d of ds) {
    if (!isActive(d, t)) continue;
    const x = d.u * env.width, y = d.v * env.height;
    if (d.type === "agent_unavailable") (d.agents ?? []).forEach((a) => out.unavailable.add(a));
    else if (d.type === "region_blocked") out.blocked.push({ x, y, r: (0.1 + 0.2 * d.severity) * m });
    else if (d.type === "demand_spike") out.spikes.push({ x, y, extra: 0.6 * d.severity, sigma: 0.1 * m });
    else if (d.type === "movement_slowdown") out.slow.push({ x, y, r: 0.2 * m, mult: 1 - 0.6 * d.severity });
    else if (d.type === "tempo_increase") out.tempo *= 1 + 1.5 * d.severity;
  }
  return out;
}

/** Onset and end of the union of enabled disturbances (instantaneous ones end at their start). */
export function disturbanceWindow(ds: Disturbance[], horizon: number): { onset: number; end: number } | null {
  const on = ds.filter((d) => d.enabled);
  if (!on.length) return null;
  const onset = Math.min(...on.map((d) => d.start));
  const end = Math.min(horizon, Math.max(...on.map((d) => d.start + (d.type === "focus_relocation" ? 0 : d.duration))));
  return { onset, end };
}

/** Random combination for Monte Carlo: each type present with probability pInclude; severity, location, timing sampled. */
export function randomDisturbanceSet(seed: number, env: Environment, nAgents: number, types: DisturbanceType[], pInclude = 0.5): Disturbance[] {
  const r = mulberry32(seed);
  const horizon = env.defaults.duration;
  const out: Disturbance[] = [];
  types.forEach((type, i) => {
    const present = r() < pInclude;
    const start = horizon * (0.15 + 0.2 * r());
    const duration = horizon * (0.1 + 0.2 * r());
    const k = 1 + Math.floor(r() * 3);
    const agents: number[] = [];
    while (agents.length < k && agents.length < nAgents) {
      const a = Math.floor(r() * nAgents);
      if (!agents.includes(a)) agents.push(a);
    }
    out.push({
      id: `mc${i}`,
      type,
      enabled: present,
      severity: 0.2 + 0.8 * r(),
      u: 0.05 + 0.9 * r(),
      v: 0.05 + 0.9 * r(),
      start,
      duration: type === "focus_relocation" ? 0 : duration,
      agents: type === "agent_unavailable" ? agents : undefined,
    });
  });
  return out;
}
