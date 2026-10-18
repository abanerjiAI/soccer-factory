import { useMemo, useState } from "react";
import { useLab } from "@/components/LabContext";
import FieldCanvas from "@/components/FieldCanvas";
import { LineChart, Scatter } from "@/components/Charts";
import { Btn, Callout, Card, PageTitle, Progress, SaveButton, Slider, Table, Tag, saveExperiment, useRunner } from "@/components/ui";
import { ExplainPanel } from "@/components/Coach";
import { OBJECTIVES, StaticEvaluator, formationPositions } from "@/engine/optimize";
import type { ObjKey, OptimizeResult, RobustResult, CandidateRow } from "@/engine/optimize";
import { runStored } from "@/engine/runner";
import { LAYOUTS, getEnvironment } from "@/engine/environments";
import { SpatialModel } from "@/engine/spatial";
import type { Vec } from "@/engine/types";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
type ParetoOut = { rows: CandidateRow[]; keys: ObjKey[]; evaluations: number; hash: string };

export default function OptimizePage() {
  const { env, formation, formations, params, seed, mode, layoutId } = useLab();
  const [objective, setObjective] = useState<ObjKey>("coverage");
  const [restarts, setRestarts] = useState(3);
  const [iters, setIters] = useState(400);
  const [view, setView] = useState<"simple" | "technical" | "why">("simple");
  const [sel, setSel] = useState<number | null>(null);
  const opt = useRunner<OptimizeResult>();
  const par = useRunner<ParetoOut>();
  const rob = useRunner<RobustResult>();

  const ev = useMemo(() => new StaticEvaluator(env, params, { seed }), [env, params, seed]);
  const ranking = useMemo(() => formations.map((fm) => ({ fm, o: ev.evaluate(formationPositions(ev.model, fm)) })), [ev, formations]);
  const best = (k: ObjKey) => {
    const dir = OBJECTIVES.find((o) => o.key === k)!.dir;
    const vals = ranking.map((r) => r.o[k]);
    return dir === "max" ? Math.max(...vals) : Math.min(...vals);
  };
  const layoutTable = useMemo(() => {
    if (mode !== "facility") return [];
    return LAYOUTS.facility.map((l) => {
      const e2 = getEnvironment("facility", l.id);
      const ev2 = new StaticEvaluator(e2, params, { seed });
      const pos = formationPositions(ev2.model, formation);
      const o = ev2.evaluate(pos);
      const worst = Math.min(...pos.map((_, i) => ev2.evaluate(pos, [i]).coverage));
      return { l, o, worst, flow: new SpatialModel(e2, params).flowCost().total };
    });
  }, [mode, params, seed, formation]);

  const optRes = opt.result;
  const pr = par.result;
  const selPos: Vec[] | null = sel !== null && pr ? pr.rows[sel].positions : null;

  return (
    <div className="space-y-4">
      <PageTitle title="Optimization — objectives, constraints, candidates, selection" sub="Objectives are kept separate; no arbitrary weighted score. Position optimisation uses simulated annealing (a heuristic): results are the best layouts FOUND, never claimed globally optimal." tags={["SIMULATED", "CALCULATED", "ASSUMED"]} />

      <Card title="1 · Configuration ranking (instant, static snapshot averaged over 4 reference situations)" right={<Tag kind="CALCULATED" />}>
        <Table dense headers={["Configuration", ...OBJECTIVES.map((o) => `${o.label} (${o.dir === "max" ? "↑" : "↓"})`)]} rows={ranking.map((r) => [r.fm.name, ...OBJECTIVES.map((o) => <span key={o.key} className={Math.abs(r.o[o.key] - best(o.key)) < 1e-9 ? "font-bold text-emerald-700" : ""}>{f(r.o[o.key])}</span>)])} />
        <p className="mt-2 text-xs text-slate-500">Green = best on that objective. Different objectives usually nominate different configurations — that is the trade-off the Pareto study below examines.</p>
      </Card>

      {mode === "facility" && (
        <Card title="Facility layout alternatives (same engine, current operator arrangement)" right={<Tag kind="CALCULATED" />}>
          <Table dense headers={["Layout", "Coverage", "Throughput", "Dead-zone share", "Worst coverage after any single operator failure", "Material-flow distance (m/unit)"]} rows={layoutTable.map((r) => [r.l.name, f(r.o.coverage), f(r.o.throughput), f(r.o.deadShare), f(r.worst), f(r.flow, 1)])} />
          <p className="mt-2 text-xs text-slate-500">Coverage-type metrics and flow distance can disagree: a layout that is best for material flow is not automatically best for operator responsiveness. Analogy limit: operators here respond to demand like players respond to the ball; real facilities have task queues, skills and safety rules that this model omits.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="2 · Position optimisation (single objective)">
          <FieldCanvas env={env} nx={ev.model.grid.nx} ny={ev.model.grid.ny} overlay="none" groups={[{ pts: optRes?.start ?? formationPositions(ev.model, formation), color: "#64748b" }, ...(optRes ? [{ pts: optRes.best, color: "#16a34a" }] : [])]} />
          <p className="mt-1 text-xs text-slate-500">Grey = start ({formation.name}); green = optimised positions.</p>
        </Card>
        <Card title="Run">
          <label className="block text-xs text-slate-600">Objective
            <select className="mt-1 w-full rounded border border-slate-300 p-1" value={objective} onChange={(e) => setObjective(e.target.value as ObjKey)}>
              {OBJECTIVES.map((o) => <option key={o.key} value={o.key}>{o.dir === "max" ? "maximise" : "minimise"} · {o.label}</option>)}
            </select>
          </label>
          <div className="mt-2 space-y-2">
            <Slider label="Restarts" min={1} max={6} step={1} value={restarts} onChange={setRestarts} />
            <Slider label="Iterations / restart" min={100} max={1500} step={50} value={iters} onChange={setIters} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Cost ≈ restarts × iterations × 4 evaluations (~0.2 ms each).</p>
          <Btn className="mt-2" disabled={opt.running} onClick={() => opt.run((p) => runStored("optimization", { mode, layoutId, params, formation, objective, restarts, iters, seed }, p).then((r) => r.summary as OptimizeResult))}>Run optimisation</Btn>
          {opt.running && <div className="mt-2"><Progress done={opt.prog.done} total={opt.prog.total} label={opt.prog.label} /></div>}
        </Card>
      </div>

      {optRes && (
        <Card title="Result" right={<div className="flex gap-1 text-xs">{(["simple", "technical", "why"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded px-2 py-1 ${view === v ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{v === "simple" ? "Simple view" : v === "technical" ? "Technical view" : "Why this solution?"}</button>)}</div>}>
          {view === "simple" && (
            <Callout kind="info">The system selected this layout because it produced the best value of “{OBJECTIVES.find((o) => o.key === optRes.objective)?.label}” that the search found under the objective and constraints we specified: {f(optRes.startObjectives[optRes.objective])} → {f(optRes.bestObjectives[optRes.objective])}. It is a deterministic calculation, not an AI judgement.</Callout>
          )}
          {view === "technical" && (
            <div className="grid gap-4 md:grid-cols-2 text-xs">
              <div className="space-y-1">
                <p><b>Objective:</b> {optRes.explanation.objective}</p>
                <p><b>Variables:</b> {optRes.explanation.variables}</p>
                <p><b>Constraints:</b> {optRes.explanation.constraints.join("; ")}</p>
                <p><b>Method:</b> {optRes.explanation.method}</p>
                <p><b>Assumptions:</b> {optRes.explanation.assumptions.join("; ")}</p>
                <p><b>Evaluations:</b> {optRes.evaluations} · <b>hash:</b> <code>{optRes.hash}</code></p>
              </div>
              <div><LineChart x={optRes.history.map((_, i) => i * 25)} xLabel="iteration" yLabel="best objective so far" series={[{ name: "best (restart that won)", y: optRes.history }]} height={170} /></div>
            </div>
          )}
          {view === "why" && (
            <div className="space-y-2 text-xs">
              <p>Candidate solutions = {optRes.restartValues.length} independent restarts. Objective values: <b>{optRes.restartValues.map((v) => f(v)).join(", ")}</b>. Spread between restarts = <b>{f(Math.max(...optRes.restartValues) - Math.min(...optRes.restartValues), 4)}</b>; selected = the best of them.</p>
              <p>Sensitivity: the table below shows what the optimisation did to the OTHER objectives. Improving one objective can worsen another — that is a trade-off, not an error.</p>
              <Callout kind="warn">{optRes.explanation.caveat}</Callout>
            </div>
          )}
          <Table dense headers={["Objective", "Start", "Optimised", "Change"]} rows={OBJECTIVES.map((o) => { const a = optRes.startObjectives[o.key], b = optRes.bestObjectives[o.key]; const good = o.dir === "max" ? b >= a : b <= a; return [o.label, f(a), f(b), <span key={o.key} className={good ? "text-emerald-700" : "text-rose-700"}>{b - a >= 0 ? "+" : ""}{f(b - a, 4)}{good ? "" : "  (worse)"}</span>]; })} />
          <div className="mt-2"><SaveButton onSave={() => saveExperiment({ kind: "optimization", mode, title: `SA ${optRes.objective} from ${formation.name}`, config: { mode, layoutId, params, formation, objective, restarts, iters, seed }, summary: optRes, hash: optRes.hash, seed, trials: restarts })} /></div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="3 · Multi-objective: Pareto study" right={<Btn disabled={par.running} onClick={() => par.run((p) => runStored("pareto", { mode, layoutId, params, seed, iters: Math.min(iters, 500) }, p).then((r) => r.summary as ParetoOut))}>Run Pareto study</Btn>}>
          {par.running && <Progress done={par.prog.done} total={par.prog.total} label={par.prog.label} />}
          {pr ? (
            <>
              <Scatter xLabel="vulnerability (↓ better)" yLabel="coverage (↑ better)" points={pr.rows.map((r, i) => ({ x: r.objectives.vulnerability, y: r.objectives.coverage, label: `${r.label}${r.pareto ? " (Pareto)" : ""}`, highlight: r.pareto, color: sel === i ? "#dc2626" : undefined }))} />
              <p className="text-xs text-slate-600">{pr.rows.filter((r) => r.pareto).length} of {pr.rows.length} candidates are non-dominated on (coverage ↑, vulnerability ↓, dead share ↓, peak utilisation ↓). Showing two of the four objectives; dominance uses all four. No single “best” exists without a stated priority.</p>
              <div className="max-h-56 overflow-auto"><Table dense headers={["", "Candidate", "Cov", "Vuln", "Dead", "Util"]} rows={pr.rows.map((r, i) => [<button key={i} className="text-indigo-600 underline" onClick={() => setSel(i)}>view</button>, <span key="l" className={r.pareto ? "font-semibold text-emerald-700" : ""}>{r.label}</span>, f(r.objectives.coverage), f(r.objectives.vulnerability), f(r.objectives.deadShare), f(r.objectives.utilMax)])} /></div>
              <SaveButton onSave={() => saveExperiment({ kind: "pareto", mode, title: `Pareto study (${mode})`, config: { mode, layoutId, params, seed, iters: Math.min(iters, 500) }, summary: pr, hash: pr.hash, seed, trials: pr.rows.length })} />
            </>
          ) : <p className="text-xs text-slate-500">Candidates: every formation, three annealed layouts (each optimising one objective), and 16 random perturbations. A candidate is Pareto-optimal if no other candidate is at least as good on all objectives and strictly better on one.</p>}
        </Card>
        <Card title="Selected candidate">
          {selPos ? <FieldCanvas env={env} nx={ev.model.grid.nx} ny={ev.model.grid.ny} groups={[{ pts: selPos, color: "#dc2626" }]} /> : <p className="text-xs text-slate-500">Choose “view” in the Pareto table.</p>}
        </Card>
      </div>

      <Card title="4 · Robust optimisation: nominal-optimal vs worst-case-optimal" right={<Btn disabled={rob.running} onClick={() => rob.run((p) => runStored("robust", { mode, layoutId, params, formation, seed, iters: 300 }, p).then((r) => r.summary as RobustResult))}>Run robust study</Btn>}>
        {rob.running && <Progress done={rob.prog.done} total={rob.prog.total} label={rob.prog.label} />}
        {rob.result ? (
          <>
            <Table dense headers={["Layout", "Nominal coverage", "Worst after 1 failure", "Mean after 2 failures", "Worst after 2 failures"]} rows={rob.result.rows.map((r) => [r.label, f(r.nominal), f(r.singleFailWorst), f(r.doubleFailMean), f(r.doubleFailWorst)])} />
            <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
              <div><p><b>Objective:</b> {rob.result.explanation.objective}</p><p><b>Method:</b> {rob.result.explanation.method}</p></div>
              <Callout kind="warn">{rob.result.explanation.caveat}</Callout>
            </div>
            <div className="mt-2 flex items-center gap-3"><SaveButton onSave={() => saveExperiment({ kind: "robust", mode, title: `Robust study from ${formation.name}`, config: { mode, layoutId, params, formation, seed, iters: 300 }, summary: rob.result!, hash: rob.result!.hash, seed, trials: 1 })} /></div>
            <ExplainPanel topic="Nominal vs robust optimisation" context={rob.result.rows.map((r) => `${r.label}: nominal ${f(r.nominal)}, worst after 1 failure ${f(r.singleFailWorst)}, mean after 2 failures ${f(r.doubleFailMean)}`).join("; ")} />
          </>
        ) : <p className="text-xs text-slate-500">Evaluation uses held-out situations and double failures never used while optimising.</p>}
      </Card>
    </div>
  );
}
