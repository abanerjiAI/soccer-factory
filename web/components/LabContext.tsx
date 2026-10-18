import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Environment, Formation, Mode, SimParams } from "@/engine/types";
import { formationsFor, getEnvironment } from "@/engine/environments";

export interface LabState {
  mode: Mode;
  setMode: (m: Mode) => void;
  layoutId: string;
  setLayoutId: (id: string) => void;
  env: Environment;
  formations: Formation[];
  formationId: string;
  setFormationId: (id: string) => void;
  formation: Formation;
  params: SimParams;
  setParam: <K extends keyof SimParams>(k: K, v: SimParams[K]) => void;
  resetParams: () => void;
  seed: number;
  setSeed: (n: number) => void;
  setCustomFormation: (f: Formation | null) => void;
}

const Ctx = createContext<LabState | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("soccer");
  const [layoutId, setLayoutId] = useState("standard");
  const [formationId, setFormationId] = useState("4-4-2");
  const [params, setParams] = useState<SimParams>(() => getEnvironment("soccer").defaults);
  const [seed, setSeed] = useState(42);
  const [custom, setCustom] = useState<{ mode: Mode; formation: Formation } | null>(null);
  const env = useMemo(() => getEnvironment(mode, layoutId), [mode, layoutId]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("cvFormation");
      if (s) setCustom(JSON.parse(s));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const formations = useMemo(() => {
    const base = formationsFor(mode);
    return custom && custom.mode === mode ? [...base, custom.formation] : base;
  }, [mode, custom]);
  const formation = formations.find((f) => f.id === formationId) ?? formations[0];

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setLayoutId(m === "soccer" ? "standard" : "linear");
    setFormationId(formationsFor(m)[0].id);
    setParams(getEnvironment(m).defaults);
  }, []);
  const setParam = useCallback(<K extends keyof SimParams>(k: K, v: SimParams[K]) => setParams((p) => ({ ...p, [k]: v })), []);
  const resetParams = useCallback(() => setParams(getEnvironment(mode).defaults), [mode]);
  const setCustomFormation = useCallback(
    (f: Formation | null) => {
      if (f) {
        const v = { mode, formation: f };
        localStorage.setItem("cvFormation", JSON.stringify(v));
        setCustom(v);
        setFormationId(f.id);
      } else {
        localStorage.removeItem("cvFormation");
        setCustom(null);
      }
    },
    [mode],
  );

  const value: LabState = { mode, setMode, layoutId, setLayoutId, env, formations, formationId: formation.id, setFormationId, formation, params, setParam, resetParams, seed, setSeed, setCustomFormation };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLab(): LabState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLab must be used inside LabProvider");
  return v;
}
