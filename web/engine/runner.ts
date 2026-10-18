/** Orchestration layer: runs any stored experiment from its configuration. Used by the UI and by the "Reproduce" check. */
import type { Formation, Mode, SimParams } from "./types";
import { formationsFor, getEnvironment } from "./environments";
import { compareScenarios, monteCarlo, sensitivity } from "./experiments";
import type { Progress, CompareConfig, MCConfig, SensConfig } from "./experiments";
import { optimizePositions, paretoStudy, robustStudy } from "./optimize";
import type { ObjKey } from "./optimize";
import { runHypothesis } from "./hypotheses";

export type StoredKind = "compare" | "montecarlo" | "sensitivity" | "optimization" | "pareto" | "robust" | "hypothesis";

export interface OptCfg { mode: Mode; layoutId: string; params: SimParams; formation: Formation; objective: ObjKey; restarts: number; iters: number; seed: number }
export interface ParetoCfg { mode: Mode; layoutId: string; params: SimParams; seed: number; iters: number }
export interface RobustCfg { mode: Mode; layoutId: string; params: SimParams; formation: Formation; seed: number; iters: number }
export interface HypCfg { id: string; mode: Mode; layoutId: string; params: SimParams; seed: number; trials: number }

export interface RunOutput {
  summary: unknown;
  hash: string;
  trials: number;
  seed: number;
}

export async function runStored(kind: StoredKind, cfg: unknown, onProgress?: Progress): Promise<RunOutput> {
  switch (kind) {
    case "compare": {
      const c = cfg as CompareConfig;
      const r = await compareScenarios(c, onProgress);
      return { summary: r, hash: r.hash, trials: c.trials, seed: c.seed };
    }
    case "montecarlo": {
      const c = cfg as MCConfig;
      const r = await monteCarlo(c, onProgress);
      return { summary: r, hash: r.hash, trials: c.trials, seed: c.seed };
    }
    case "sensitivity": {
      const c = cfg as SensConfig;
      const r = await sensitivity(c, onProgress);
      return { summary: r, hash: r.hash, trials: c.trials, seed: c.seed };
    }
    case "optimization": {
      const c = cfg as OptCfg;
      const r = await optimizePositions({ env: getEnvironment(c.mode, c.layoutId), params: c.params, formation: c.formation, objective: c.objective, restarts: c.restarts, iters: c.iters, seed: c.seed }, onProgress);
      return { summary: r, hash: r.hash, trials: c.restarts, seed: c.seed };
    }
    case "pareto": {
      const c = cfg as ParetoCfg;
      const r = await paretoStudy({ env: getEnvironment(c.mode, c.layoutId), params: c.params, formations: formationsFor(c.mode), seed: c.seed, iters: c.iters }, onProgress);
      return { summary: r, hash: r.hash, trials: r.rows.length, seed: c.seed };
    }
    case "robust": {
      const c = cfg as RobustCfg;
      const r = await robustStudy({ env: getEnvironment(c.mode, c.layoutId), params: c.params, formation: c.formation, seed: c.seed, iters: c.iters }, onProgress);
      return { summary: r, hash: r.hash, trials: 1, seed: c.seed };
    }
    case "hypothesis": {
      const c = cfg as HypCfg;
      const r = await runHypothesis(c.id, { mode: c.mode, layoutId: c.layoutId, params: c.params, seed: c.seed, trials: c.trials }, onProgress);
      return { summary: r, hash: r.hash, trials: c.trials, seed: c.seed };
    }
  }
}
