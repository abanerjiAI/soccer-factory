/**
 * Environment definitions. ONE contract (Environment) for both modes => same mathematical engine.
 * All numeric defaults here are ASSUMED project parameters (not measured, not calibrated to tracking data).
 */
import type { Environment, Formation, Mode, SimParams, Vec } from "./types";
import { hashSeed, mulberry32 } from "./rng";

const soccerDefaults: SimParams = {
  dt: 0.25,
  duration: 60,
  metricEvery: 0.5,
  vMax: 7.5,
  aMax: 3.5,
  reaction: 0.4,
  responseBudget: 4,
  softness: 0.6,
  capacityPerAgent: 12,
  totalDemand: 100,
  minSpacing: 8,
  bodyRadius: 0.8,
  formationRadius: 18,
  ballResponse: 0.6,
  demandAttraction: 0.5,
  repulsion: 0.8,
  collisionAvoidance: true,
  focusSpeed: 9,
  focusHopEvery: 3,
  deadCoverage: 0.35,
  persistSeconds: 8,
  oppPull: 0.35,
  oppWobble: 3,
  disturbanceStart: 20,
  disturbanceDuration: 15,
  alignment: 0,
  tactical: false,
  tacticalShift: 8,
};

const facilityDefaults: SimParams = {
  dt: 0.5,
  duration: 120,
  metricEvery: 1,
  vMax: 1.6,
  aMax: 1.0,
  reaction: 1.0,
  responseBudget: 12,
  softness: 2,
  capacityPerAgent: 10,
  totalDemand: 45,
  minSpacing: 4,
  bodyRadius: 0.5,
  formationRadius: 12,
  ballResponse: 0.5,
  demandAttraction: 0.5,
  repulsion: 0.8,
  collisionAvoidance: true,
  focusSpeed: 3,
  focusHopEvery: 8,
  deadCoverage: 0.35,
  persistSeconds: 20,
  oppPull: 0,
  oppWobble: 0,
  disturbanceStart: 40,
  disturbanceDuration: 40,
  alignment: 0,
  tactical: false,
  tacticalShift: 0,
};

const S = (role: string, u: number, v: number) => ({ role, u, v });
const D = "DEF", M = "MID", F = "FWD";

export const SOCCER_FORMATIONS: Formation[] = [
  {
    id: "4-4-2",
    name: "4-4-2",
    description: "Two flat banks of four plus two forwards.",
    positions: [S(D, 0.2, 0.12), S(D, 0.2, 0.38), S(D, 0.2, 0.62), S(D, 0.2, 0.88), S(M, 0.42, 0.12), S(M, 0.42, 0.38), S(M, 0.42, 0.62), S(M, 0.42, 0.88), S(F, 0.62, 0.35), S(F, 0.62, 0.65)],
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    description: "Back four, midfield three, wide forwards.",
    positions: [S(D, 0.2, 0.12), S(D, 0.2, 0.38), S(D, 0.2, 0.62), S(D, 0.2, 0.88), S(M, 0.4, 0.25), S(M, 0.4, 0.5), S(M, 0.4, 0.75), S(F, 0.65, 0.15), S(F, 0.68, 0.5), S(F, 0.65, 0.85)],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    description: "Three centre-backs, wing-backs, two forwards.",
    positions: [S(D, 0.2, 0.2), S(D, 0.2, 0.5), S(D, 0.2, 0.8), S(M, 0.38, 0.06), S(M, 0.42, 0.3), S(M, 0.42, 0.5), S(M, 0.42, 0.7), S(M, 0.38, 0.94), S(F, 0.62, 0.35), S(F, 0.62, 0.65)],
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    description: "Defensive: five at the back, compact midfield.",
    positions: [S(D, 0.2, 0.06), S(D, 0.2, 0.28), S(D, 0.2, 0.5), S(D, 0.2, 0.72), S(D, 0.2, 0.94), S(M, 0.42, 0.25), S(M, 0.42, 0.5), S(M, 0.42, 0.75), S(F, 0.62, 0.35), S(F, 0.62, 0.65)],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    description: "Double pivot, three attacking midfielders, one striker.",
    positions: [S(D, 0.2, 0.12), S(D, 0.2, 0.38), S(D, 0.2, 0.62), S(D, 0.2, 0.88), S(M, 0.36, 0.35), S(M, 0.36, 0.65), S(M, 0.52, 0.15), S(M, 0.52, 0.5), S(M, 0.52, 0.85), S(F, 0.68, 0.5)],
  },
];

const O = "OP";
export const FACILITY_FORMATIONS: Formation[] = [
  {
    id: "spread",
    name: "Evenly spread",
    description: "Operators on a 3x2 grid over the floor.",
    positions: [S(O, 0.2, 0.3), S(O, 0.5, 0.3), S(O, 0.8, 0.3), S(O, 0.2, 0.7), S(O, 0.5, 0.7), S(O, 0.8, 0.7)],
  },
  {
    id: "central",
    name: "Central cluster",
    description: "All operators near the centre of the floor.",
    positions: [S(O, 0.4, 0.45), S(O, 0.5, 0.45), S(O, 0.6, 0.45), S(O, 0.4, 0.58), S(O, 0.5, 0.58), S(O, 0.6, 0.58)],
  },
  {
    id: "centreline",
    name: "Centre-line row",
    description: "Operators in a row along the main aisle.",
    positions: [S(O, 0.12, 0.5), S(O, 0.28, 0.5), S(O, 0.44, 0.5), S(O, 0.6, 0.5), S(O, 0.76, 0.5), S(O, 0.9, 0.5)],
  },
  {
    id: "depot",
    name: "Depot-based",
    description: "Operators wait near the west depot.",
    positions: [S(O, 0.08, 0.2), S(O, 0.08, 0.4), S(O, 0.08, 0.6), S(O, 0.08, 0.8), S(O, 0.2, 0.3), S(O, 0.2, 0.7)],
  },
];

export const LAYOUTS: Record<Mode, { id: string; name: string; description: string }[]> = {
  soccer: [{ id: "standard", name: "Standard pitch 105 x 68 m", description: "FIFA-typical dimensions (EXTERNAL FACT: 105x68 m is the commonly used size; also the Metrica sample-data size)." }],
  facility: [
    { id: "linear", name: "Linear flow line", description: "Six stations in a row, racks above and below the main aisle." },
    { id: "ushape", name: "U-shaped cell", description: "Stations around a central restricted block; entry and exit adjacent." },
    { id: "functional", name: "Functional (scattered)", description: "Stations grouped by function, flow zig-zags across the floor." },
  ],
};

export function formationsFor(mode: Mode): Formation[] {
  return mode === "soccer" ? SOCCER_FORMATIONS : FACILITY_FORMATIONS;
}

const disturbanceVocab: Record<Mode, Environment["vocab"]["disturbance"]> = {
  soccer: {
    focus_relocation: "Ball relocation",
    agent_unavailable: "Player(s) unavailable",
    region_blocked: "Region inaccessible",
    demand_spike: "Demand spike (threat surge)",
    movement_slowdown: "Opponent pressing zone (speed reduction)",
    tempo_increase: "Increased movement demand (faster play)",
  },
  facility: {
    focus_relocation: "Priority job relocation",
    agent_unavailable: "Operator(s) unavailable",
    region_blocked: "Aisle / area closed",
    demand_spike: "Demand spike (rush order)",
    movement_slowdown: "Aisle congestion (vehicle traffic)",
    tempo_increase: "Faster job arrival tempo",
  },
};

interface StationDef {
  id: string;
  x: number;
  y: number;
  w: number;
  critical?: boolean;
}
const facilityLayouts: Record<string, { stations: StationDef[]; blocked: { x: number; y: number; w: number; h: number }[] }> = {
  linear: {
    stations: [
      { id: "S1", x: 8, y: 20, w: 2 },
      { id: "S2", x: 17, y: 20, w: 2.5 },
      { id: "S3", x: 26, y: 20, w: 3 },
      { id: "S4", x: 35, y: 20, w: 3.5, critical: true },
      { id: "S5", x: 44, y: 20, w: 2.5 },
      { id: "S6", x: 53, y: 20, w: 2 },
    ],
    blocked: [
      { x: 6, y: 3, w: 48, h: 8 },
      { x: 6, y: 29, w: 48, h: 8 },
    ],
  },
  ushape: {
    stations: [
      { id: "S1", x: 10, y: 10, w: 2 },
      { id: "S2", x: 10, y: 24, w: 2.5 },
      { id: "S3", x: 20, y: 33, w: 3 },
      { id: "S4", x: 34, y: 33, w: 3.5, critical: true },
      { id: "S5", x: 48, y: 24, w: 2.5 },
      { id: "S6", x: 48, y: 10, w: 2 },
    ],
    blocked: [{ x: 18, y: 8, w: 22, h: 14 }],
  },
  functional: {
    stations: [
      { id: "S1", x: 8, y: 8, w: 2 },
      { id: "S2", x: 50, y: 32, w: 2.5 },
      { id: "S3", x: 12, y: 30, w: 3 },
      { id: "S4", x: 48, y: 10, w: 3.5, critical: true },
      { id: "S5", x: 30, y: 33, w: 2.5 },
      { id: "S6", x: 54, y: 20, w: 2 },
    ],
    blocked: [{ x: 24, y: 6, w: 12, h: 14 }],
  },
};

export function getEnvironment(mode: Mode, layoutId?: string): Environment {
  if (mode === "soccer") {
    const W = 105, H = 68;
    const oppBase = [
      [0.8, 0.12], [0.8, 0.38], [0.8, 0.62], [0.8, 0.88],
      [0.62, 0.12], [0.62, 0.38], [0.62, 0.62], [0.62, 0.88],
      [0.42, 0.35], [0.42, 0.65],
    ];
    return {
      mode,
      layoutId: "standard",
      name: "Soccer pitch",
      width: W,
      height: H,
      nx: 24,
      ny: 16,
      vocab: { agent: "player", agents: "players", focus: "ball", demand: "threat-weighted spatial demand", fieldName: "pitch", opponent: "opponent", disturbance: disturbanceVocab.soccer },
      baseWeight: 1,
      fixedSources: [{ id: "own-goal", x: 0, y: H / 2, weight: 2, sigma: 9, critical: true }],
      focusWeight: 3,
      focusSigma: 10,
      opponents: oppBase.map(([u, v]) => ({ x: u * W, y: v * H })),
      opponentWeight: 0.35,
      opponentSigma: 9,
      staticBlocked: [],
      focusCandidates: null,
      focusStart: { x: W * 0.5, y: H * 0.5 },
      flowRoute: [],
      roleGain: { DEF: 0.25, MID: 0.4, FWD: 0.5 },
      defaults: soccerDefaults,
    };
  }
  const id = layoutId && facilityLayouts[layoutId] ? layoutId : "linear";
  const lay = facilityLayouts[id];
  return {
    mode,
    layoutId: id,
    name: "Industrial facility",
    width: 60,
    height: 40,
    nx: 24,
    ny: 16,
    vocab: { agent: "operator", agents: "operators", focus: "active job", demand: "job-arrival demand", fieldName: "floor", opponent: "traffic", disturbance: disturbanceVocab.facility },
    baseWeight: 0.5,
    fixedSources: lay.stations.map((s) => ({ id: s.id, x: s.x, y: s.y, weight: s.w, sigma: 3, critical: s.critical })),
    focusWeight: 2,
    focusSigma: 4,
    opponents: [],
    opponentWeight: 0,
    opponentSigma: 1,
    staticBlocked: lay.blocked,
    focusCandidates: lay.stations.map((s) => ({ x: s.x, y: s.y })),
    focusStart: { x: lay.stations[0].x, y: lay.stations[0].y },
    flowRoute: lay.stations.map((s) => s.id),
    roleGain: { OP: 0.35 },
    defaults: facilityDefaults,
  };
}

/** Pure function: target of the h-th hop of the focus (ball / active job) for a given seed. */
export function hopTarget(env: Environment, seed: number, h: number): Vec {
  const r = mulberry32(hashSeed(seed, h, 9001));
  if (env.focusCandidates) return env.focusCandidates[Math.floor(r() * env.focusCandidates.length) % env.focusCandidates.length];
  return { x: env.width * (0.1 + 0.85 * r()), y: env.height * (0.05 + 0.9 * r()) };
}

/** Pure function: opponent positions at time t for a given focus (shifted toward the ball + seeded wobble). */
export function opponentPositions(env: Environment, focus: Vec, t: number, seed: number, p: Pick<SimParams, "oppPull" | "oppWobble">): Vec[] {
  return env.opponents.map((b, j) => {
    const r = mulberry32(hashSeed(seed, j, 777));
    const ph1 = r() * 6.283, ph2 = r() * 6.283, per = 7 + r() * 5;
    const x = b.x + p.oppPull * (focus.x - b.x) + p.oppWobble * Math.sin((6.283 * t) / per + ph1);
    const y = b.y + p.oppPull * (focus.y - b.y) + p.oppWobble * Math.cos((6.283 * t) / per + ph2);
    return { x: Math.min(env.width, Math.max(0, x)), y: Math.min(env.height, Math.max(0, y)) };
  });
}
