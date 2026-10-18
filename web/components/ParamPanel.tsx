import type { SimParams } from "@/engine/types";
import { Btn, Slider, Tag } from "./ui";
import { useLab } from "./LabContext";

interface Row {
  key: keyof SimParams;
  label: string;
  unit?: string;
  lo: number;
  hi: number;
  hint: string;
  frac?: boolean;
}

/** The three sliders worth demonstrating. Everything else is an expert parameter. */
const MAIN: Row[] = [
  { key: "vMax", label: "Top speed", unit: "m/s", lo: 0.25, hi: 2, hint: "How fast a player (or operator) can move: the movement constraint." },
  { key: "responseBudget", label: "Time to arrive (T*)", unit: "s", lo: 0.4, hi: 2.5, hint: "A spot only counts as covered if someone can get there in this time." },
  { key: "capacityPerAgent", label: "Capacity per player", lo: 0.3, hi: 2.5, hint: "How much threat / work one player can handle per second before being overloaded." },
];
const EXPERT: Row[] = [
  { key: "aMax", label: "Acceleration limit", unit: "m/s²", lo: 0.25, hi: 2.5, hint: "How quickly a player can speed up." },
  { key: "reaction", label: "Reaction time", unit: "s", lo: 0, hi: 3, hint: "Delay before moving." },
  { key: "totalDemand", label: "Total demand", lo: 0.25, hi: 2.5, hint: "How much threat / work there is on the whole field." },
  { key: "formationRadius", label: "Formation radius", unit: "m", lo: 0, hi: 2, hint: "Max distance from the assigned home position." },
  { key: "ballResponse", label: "Focus (ball) response", lo: 0, hi: 1, frac: true, hint: "How much the whole block shifts toward the ball / active job." },
  { key: "demandAttraction", label: "Demand attraction", lo: 0, hi: 1, frac: true, hint: "Pull toward unserved demand." },
  { key: "repulsion", label: "Teammate repulsion", lo: 0, hi: 2, frac: true, hint: "Spacing force between teammates." },
  { key: "alignment", label: "Flocking: velocity alignment", lo: 0, hi: 1, frac: true, hint: "Match the velocity of nearby teammates (moving as a connected group). 0 = off." },
];

function SliderRow({ n, defaults }: { n: Row; defaults: SimParams }) {
  const { params, setParam } = useLab();
  const base = (defaults[n.key] as number | undefined) ?? 0;
  const lo = n.frac ? n.lo : base * n.lo,
    hi = n.frac ? n.hi : base * n.hi;
  const step = n.frac ? 0.05 : Math.max((hi - lo) / 100, 0.01);
  return <Slider label={n.label} unit={n.unit} hint={n.hint} min={lo} max={hi} step={step} value={(params[n.key] as number | undefined) ?? 0} onChange={(v) => setParam(n.key, v as never)} />;
}

export default function ParamPanel({ keys }: { keys?: (keyof SimParams)[] }) {
  const { params, setParam, resetParams, env, mode } = useLab();
  const d = env.defaults;
  const main = keys ? [...MAIN, ...EXPERT].filter((n) => keys.includes(n.key)) : MAIN;
  const expert = keys ? [] : EXPERT;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          {keys ? "Parameters" : "Three sliders"} <Tag kind="ASSUMED" title="Not calibrated against real data (the Real Match Data page can estimate speeds)" />
        </span>
        <Btn kind="ghost" className="!px-2 !py-0.5 !text-xs" onClick={resetParams}>
          reset
        </Btn>
      </div>
      {main.map((n) => (
        <SliderRow key={n.key} n={n.key === "capacityPerAgent" ? { ...n, label: `Capacity per ${env.vocab.agent}` } : n} defaults={d} />
      ))}
      {!keys && (
        <details className="rounded border border-slate-200 bg-slate-50 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">Expert parameters ({expert.length + (mode === "soccer" ? 2 : 1)})</summary>
          <div className="mt-2 space-y-2">
            {expert.map((n) => (
              <SliderRow key={n.key} n={n} defaults={d} />
            ))}
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={params.collisionAvoidance} onChange={(e) => setParam("collisionAvoidance", e.target.checked)} /> Collision avoidance (hard separation)
            </label>
            {mode === "soccer" && (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-600" title="Press / hold / drop: the whole block pushes up or drops back when the ball is deep in the attacking or defending third.">
                  <input type="checkbox" checked={!!params.tactical} onChange={(e) => setParam("tactical", e.target.checked)} /> Tactical state machine (press / hold / drop)
                </label>
                {params.tactical && <Slider label="Press / drop shift" unit="m" hint="How far the block moves." min={2} max={16} step={1} value={params.tacticalShift ?? 8} onChange={(v) => setParam("tacticalShift", v)} />}
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
