/**
 * DATA CONTRACTS (Gate 1).
 * Coordinate system (ALL modules): metres, origin top-left, x to the right, y downward
 * (same orientation as screen / image pixels). Normalised field coordinates are u=x/W, v=y/H in [0,1].
 * Time: seconds from scenario start. Demand/capacity: "demand units per second" (dimensionless, ASSUMED scale).
 */
export const MODEL_VERSION = "0.1.0";
export const SOFTWARE_VERSION = "1.1.0";

export type Mode = "soccer" | "facility";

export interface Vec {
  x: number;
  y: number;
}

/** Contract for a single agent at one instant. Units: m, m/s, m/s^2, s. */
export interface AgentState {
  id: string;
  team: "A" | "B";
  role: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  available: boolean;
  timestamp: number;
}

export interface FormationSlot {
  role: string;
  u: number;
  v: number;
}
export interface Formation {
  id: string;
  name: string;
  description: string;
  positions: FormationSlot[];
}

export interface Source {
  id: string;
  x: number;
  y: number;
  weight: number;
  sigma: number;
  critical?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DisturbanceType =
  | "focus_relocation"
  | "agent_unavailable"
  | "region_blocked"
  | "demand_spike"
  | "movement_slowdown"
  | "tempo_increase";

export interface Disturbance {
  id: string;
  type: DisturbanceType;
  enabled: boolean;
  /** 0..1 */
  severity: number;
  /** normalised location */
  u: number;
  v: number;
  /** seconds */
  start: number;
  duration: number;
  /** for agent_unavailable: indices into the formation */
  agents?: number[];
}

export interface Environment {
  mode: Mode;
  layoutId: string;
  name: string;
  width: number;
  height: number;
  nx: number;
  ny: number;
  vocab: {
    agent: string;
    agents: string;
    focus: string;
    demand: string;
    fieldName: string;
    opponent: string;
    disturbance: Record<DisturbanceType, string>;
  };
  baseWeight: number;
  fixedSources: Source[];
  focusWeight: number;
  focusSigma: number;
  opponents: Vec[];
  opponentWeight: number;
  opponentSigma: number;
  staticBlocked: Rect[];
  /** null => uniformly random inside field for the focus; otherwise hop among these points (e.g. stations) */
  focusCandidates: Vec[] | null;
  focusStart: Vec;
  /** station ids in material-flow order (facility only) */
  flowRoute: string[];
  roleGain: Record<string, number>;
  defaults: SimParams;
}

export interface SimParams {
  dt: number;
  duration: number;
  metricEvery: number;
  vMax: number;
  aMax: number;
  reaction: number;
  responseBudget: number;
  softness: number;
  capacityPerAgent: number;
  totalDemand: number;
  minSpacing: number;
  bodyRadius: number;
  formationRadius: number;
  ballResponse: number;
  demandAttraction: number;
  repulsion: number;
  collisionAvoidance: boolean;
  focusSpeed: number;
  focusHopEvery: number;
  deadCoverage: number;
  persistSeconds: number;
  oppPull: number;
  oppWobble: number;
  /** default disturbance onset and duration used by presets */
  disturbanceStart: number;
  disturbanceDuration: number;
  /** Flocking-style velocity alignment with nearby teammates, 0..1 (0 = off; default). */
  alignment?: number;
  /** Tactical state machine on/off (press / hold / drop). Off by default. */
  tactical?: boolean;
  /** metres the whole block moves forward (press) or back (drop) when the focus is deep in the attacking / defending third */
  tacticalShift?: number;
}

export interface MetricSample {
  t: number;
  coverage: number;
  hardCoverage: number;
  meanResponse: number;
  deadArea: number;
  deadDemandShare: number;
  throughput: number;
  accessLoss: number;
  capacityLoss: number;
  elevationGain: number;
  utilMean: number;
  utilMax: number;
  queuePressure: number;
  criticalCoverage: number;
  totalDemand: number;
  activeAgents: number;
  meanSpeed: number;
}

export interface Frame {
  t: number;
  A: number[];
  B: number[];
  focus: [number, number];
  avail: boolean[];
  blocked: { x: number; y: number; r: number }[];
  cov?: Float32Array;
  demand?: Float32Array;
  dead?: Uint8Array;
  bott?: Float32Array;
  access?: Float32Array;
}

export interface SimEvent {
  t: number;
  text: string;
}

export interface SimResult {
  series: MetricSample[];
  frames: Frame[];
  events: SimEvent[];
  finalState: AgentState[];
  dead: { persistentArea: number; temporaryArea: number; persistentMap: Uint8Array; temporaryMap: Uint8Array };
  metadata: {
    modelVersion: string;
    softwareVersion: string;
    seed: number;
    mode: Mode;
    layoutId: string;
    formation: string;
    gridNx: number;
    gridNy: number;
    steps: number;
    maxObservedSpeed: number;
    maxObservedAccel: number;
    repairedSlots: number;
  };
  hash: string;
}
