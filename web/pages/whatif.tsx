import { useDeferredValue, useMemo, useState } from "react";
import { useLab } from "@/components/LabContext";
import FieldCanvas from "@/components/FieldCanvas";
import { Bars, LineChart } from "@/components/Charts";
import { Btn, Callout, Card, PageTitle, Progress, SaveButton, Slider, Stat, Table, Tag, saveExperiment, useRunner } from "@/components/ui";
import { ExplainPanel } from "@/components/Coach";
import { defaultDisturbanceMatrix, DISTURBANCE_TYPES, disturbanceWindow } from "@/engine/disturbances";
import type { Disturbance } from "@/engine/types";
import { runStored } from "@/engine/runner";
import type { CompareResult } from "@/engine/experiments";
import { runSimulation } from "@/engine/sim";
import ParamPanel from "@/components/ParamPanel";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const PIN = ["#e11d48", "#7c3aed", "#0369a1", "#b45309", "#047857", "#be185d"];

export default function WhatIfPage() {
  const { env, formation, params, seed, mode, layoutId } = useLab();
  const [ds, setDs] = useState<Disturbance[]>(() => defaultDisturbanceMatrix(env));
  const [envKey, setEnvKey] = useState(env.mode + env.layoutId);
  const [pickFor, setPickFor] = useState<string>("");
  const [trials, setTrials] = useState(8);
  const runner = useRunner<CompareResult>();
  const [idx, setIdx] = useState(0);
  if (envKey !== env.mode + env.layoutId) {
    setEnvKey(env.mode + env.layoutId);
    setDs(defaultDisturbanceMatrix(env));
  }
  const update = (id: string, patch: Partial<Disturbance>) => setDs((a) => a.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const enabled = ds.filter((d) => d.enabled);
  const dDs = useDeferredValue(ds);
  const preview = useMemo(() => runSimulation({ env, formation, params, seed, disturbances: dDs, recordFrames: true, recordFields: true, gridScale: 1 }), [env, formation, params, seed, dDs]);
  const pi = Math.min(idx, preview.frames.length - 1);
  const res = runner.result;
  const win = res?.window ?? disturbanceWindow(ds, params.duration);

  const stages = useMemo(() => {
    if (!res) return null;
    const sc = res.combined ?? res.scenarios[0];
    if (!sc || !res.window) return null;
    const t = sc.series.t, cov = sc.series.coverage, base = res.baseline.series.coverage;
    const pre = base.filter((_, k) => t[k] < res.window!.onset);
    const during = cov.filter((_, k) => t[k] >= res.window!.onset && t[k] <= res.window!.end);
    const endIdx = t.findIndex((x) => x >= res.window!.end);
    return { label: sc.label, baseline: pre.reduce((a, b) => a + b, 0) / Math.max(1, pre.length), min: Math.min(...during), atEnd: cov[Math.max(0, endIdx)], final: cov[cov.length - 1], baseFinal: base[base.length - 1], rec: sc.fracRecovered, recT: sc.recoveryTime.mean, cens: sc.fracCensored };
  }, [res]);

  const run = () =>
    runner.run((p) => runStored("compare", { mode, layoutId, formation, params, seed, disturbances: ds, trials }, p).then((r) => r.summary as CompareResult));

  return (
    <div className="space-y-4">
      <PageTitle title="What-If Disturbance Laboratory" sub="Select any combination of disturbances, set severity, location, timing and duration, then compare BASELINE → DISTURBANCE → RESPONSE → RECOVERY → FINAL. Each scenario is run on the same random seeds (paired comparison)." tags={["SIMULATED", "ASSUMED"]} />
      <Card title="Disturbance selection matrix" right={<span className="text-xs text-slate-500">Click the {env.vocab.fieldName} to place the location of the row chosen under “place”.</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 uppercase text-slate-500">
                <th className="p-1">On</th><th className="p-1">Disturbance</th><th className="p-1">Severity / agents</th><th className="p-1">Location</th><th className="p-1">Start (s)</th><th className="p-1">Duration (s)</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d, k) => {
                const meta = DISTURBANCE_TYPES.find((m) => m.type === d.type)!;
                return (
                  <tr key={d.id} className={`border-b border-slate-100 align-top ${d.enabled ? "bg-rose-50/60" : ""}`}>
                    <td className="p-1"><input type="checkbox" checked={d.enabled} onChange={(e) => update(d.id, { enabled: e.target.checked })} /></td>
                    <td className="p-1 font-medium" title={meta.meaning} style={{ color: PIN[k] }}>{env.vocab.disturbance[d.type]}<div className="max-w-xs font-normal text-slate-500">{meta.meaning}</div></td>
                    <td className="w-48 p-1">
                      {meta.usesSeverity && <Slider label="severity" min={0.1} max={1} step={0.05} value={d.severity} onChange={(v) => update(d.id, { severity: v })} />}
                      {meta.usesAgents && (
                        <div className="flex flex-wrap gap-1">
                          {formation.positions.map((_, a) => (
                            <button key={a} className={`h-6 w-6 rounded text-[11px] ${d.agents?.includes(a) ? "bg-slate-700 text-white" : "border border-slate-300"}`} onClick={() => update(d.id, { agents: d.agents?.includes(a) ? d.agents.filter((q) => q !== a) : [...(d.agents ?? []), a] })}>{a}</button>
                          ))}
                        </div>
                      )}
                      {!meta.usesSeverity && !meta.usesAgents && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-1">
                      {meta.usesLocation ? (
                        <label className="flex items-center gap-1"><input type="radio" name="pick" checked={pickFor === d.id} onChange={() => setPickFor(d.id)} />place ({d.u.toFixed(2)}, {d.v.toFixed(2)})</label>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="w-32 p-1"><Slider label="" min={0} max={params.duration - 5} step={1} value={d.start} onChange={(v) => update(d.id, { start: v })} /></td>
                    <td className="w-32 p-1">{d.type === "focus_relocation" ? <span className="text-slate-400">instant</span> : <Slider label="" min={2} max={params.duration} step={1} value={d.duration} onChange={(v) => update(d.id, { duration: v })} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`Single-seed preview (seed ${seed}) — ${enabled.length} disturbance(s) active in scenario`}>
          <FieldCanvas env={env} frame={preview.frames[pi]} overlay="coverage" nx={preview.metadata.gridNx} ny={preview.metadata.gridNy} pins={ds.filter((d) => d.enabled && DISTURBANCE_TYPES.find((m) => m.type === d.type)?.usesLocation).map((d) => ({ u: d.u, v: d.v, label: env.vocab.disturbance[d.type].split(" ")[0], color: PIN[ds.indexOf(d)] }))} onPick={pickFor ? (u, v) => update(pickFor, { u, v }) : undefined} />
          <div className="mt-2 flex items-center gap-3 text-xs">
            <input type="range" className="flex-1 accent-indigo-600" min={0} max={preview.frames.length - 1} value={pi} onChange={(e) => setIdx(Number(e.target.value))} />
            <span className="font-mono">t = {preview.frames[pi].t.toFixed(1)} s · coverage {f(preview.series[pi].coverage)}</span>
          </div>
          <div className="mt-2 text-xs text-slate-600">{preview.events.map((e, k) => <div key={k}>t={e.t.toFixed(1)}s — {e.text}</div>)}</div>
        </Card>
        <div className="space-y-3">
          <Card title="Run controlled experiment">
            <Slider label="Repeated trials (seeds)" min={2} max={30} step={1} value={trials} onChange={setTrials} />
            <p className="mt-1 text-xs text-slate-500">Cost ≈ trials × (1 + scenarios) simulations (~20–40 ms each). Use few trials for a quick look, ≥ 10 for intervals.</p>
            <div className="mt-2 flex gap-2"><Btn disabled={runner.running || enabled.length === 0} onClick={run}>Run scenarios</Btn></div>
            {runner.running && <div className="mt-2"><Progress done={runner.prog.done} total={runner.prog.total} label={runner.prog.label} /></div>}
            {runner.error && <Callout kind="bad">{runner.error}</Callout>}
            {enabled.length === 0 && <p className="mt-2 text-xs text-amber-700">Enable at least one disturbance.</p>}
          </Card>
          <Card><ParamPanel keys={["vMax", "aMax", "reaction", "capacityPerAgent", "totalDemand"]} /></Card>
        </div>
      </div>

      {res && stages && win && (
        <>
          <Card title="Baseline → Disturbance → System response → Recovery → Final" right={<Tag kind="SIMULATED" />}>
            <div className="grid gap-2 md:grid-cols-5">
              <Stat label="1 · Baseline" value={f(stages.baseline)} sub="mean coverage before onset" />
              <Stat label="2 · Disturbance" value={`t=${win.onset.toFixed(0)}–${win.end.toFixed(0)} s`} sub={stages.label} tone="warn" />
              <Stat label="3 · Response (lowest)" value={f(stages.min)} sub={`drop ${f(stages.baseline - stages.min)}`} tone="bad" />
              <Stat label="4 · Recovery" value={stages.cens > 0.5 ? "not within horizon" : Number.isFinite(stages.recT) ? `${stages.recT.toFixed(1)} s` : "none"} sub={`recovered in ${(stages.rec * 100).toFixed(0)}% of trials (gap ≤ 0.02)`} />
              <Stat label="5 · Final" value={f(stages.final)} sub={`baseline run: ${f(stages.baseFinal)}`} />
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Mean coverage over time (mean of trials)">
              <LineChart x={res.baseline.series.t} xLabel="time (s)" yLabel="coverage" yMin={0} yMax={1} windows={[{ from: win.onset, to: win.end, label: "disturbance" }]} series={[{ name: "baseline", y: res.baseline.series.coverage, color: "#0f172a", dashed: true }, ...res.scenarios.map((s) => ({ name: s.label, y: s.series.coverage }))]} />
            </Card>
            <Card title="Mean throughput over time">
              <LineChart x={res.baseline.series.t} xLabel="time (s)" yLabel="served fraction" yMin={0} yMax={1} windows={[{ from: win.onset, to: win.end }]} series={[{ name: "baseline", y: res.baseline.series.throughput, color: "#0f172a", dashed: true }, ...res.scenarios.map((s) => ({ name: s.label, y: s.series.throughput }))]} />
            </Card>
          </div>
          <Card title={`Resilience dimensions — kept separate (n = ${res.metadata.trials} paired trials; 95% t-intervals)`}>
            <Table dense headers={["Scenario", "Peak coverage loss", "Integrated loss (mean over horizon after onset)", "Retained fraction (min)", "Recovery time after end (s)", "Recovered", "Throughput integrated loss"]} rows={res.scenarios.map((s) => [s.label, `${f(s.peakLoss.mean)} [${f(s.peakLoss.lo)}, ${f(s.peakLoss.hi)}]`, `${f(s.meanLoss.mean, 4)} [${f(s.meanLoss.lo, 4)}, ${f(s.meanLoss.hi, 4)}]`, f(s.retained.mean), s.recoveryTime.n ? f(s.recoveryTime.mean, 1) : s.fracCensored > 0.5 ? "persists" : "—", `${(s.fracRecovered * 100).toFixed(0)}%`, f(s.thrMeanLoss.mean, 4)])} />
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Bars unit="" items={res.scenarios.map((s) => ({ label: s.label, value: s.meanLoss.mean, lo: s.meanLoss.lo, hi: s.meanLoss.hi, color: s.id === "combined" ? "#be123c" : "#6366f1" }))} />
              <div className="text-xs text-slate-600">
                <p><b>Why separate?</b> Magnitude (peak), duration (recovery time) and area (integrated loss) answer different questions and have different units; combining them would need arbitrary weights. Only the integrated loss (area between baseline and disturbed curves, the “resilience triangle”) is a physically meaningful combination.</p>
                {res.interaction?.combinedVsMaxSingle && (
                  <Callout kind="info" title="Combined vs single">
                    Under these conditions the combined scenario had larger integrated loss than the worst single disturbance in {(res.interaction.combinedVsMaxSingle.fracPositive * 100).toFixed(0)}% of {res.metadata.trials} paired trials (mean difference {f(res.interaction.combinedVsMaxSingle.mean, 4)}, 95% CI [{f(res.interaction.combinedVsMaxSingle.lo, 4)}, {f(res.interaction.combinedVsMaxSingle.hi, 4)}]). Combined minus sum of singles: {f(res.interaction.combinedMinusSum?.mean ?? NaN, 4)} (positive = super-additive; may reflect spatial overlap of disturbances).
                  </Callout>
                )}
              </div>
            </div>
          </Card>
          <Card>
            <div className="mb-2 flex flex-wrap items-center gap-3"><SaveButton onSave={() => saveExperiment({ kind: "compare", mode, title: `What-if: ${enabled.map((d) => d.type).join("+")} · ${formation.name}`, config: { mode, layoutId, formation, params, seed, disturbances: ds, trials }, summary: res, hash: res.hash, seed, trials, uncertainty: "95% t-intervals over seeds (variation from focus path and opponent motion only)" })} /><span className="text-xs text-slate-500">hash {res.hash} · seeds derived from {seed}</span></div>
            <ExplainPanel topic="What-if disturbance comparison" context={`Mode ${mode}, formation ${formation.name}. ${res.scenarios.map((s) => `${s.label}: integrated coverage loss ${f(s.meanLoss.mean, 4)} (95% CI ${f(s.meanLoss.lo, 4)} to ${f(s.meanLoss.hi, 4)}), peak ${f(s.peakLoss.mean)}`).join("; ")}. n=${res.metadata.trials} paired simulated trials.`} />
          </Card>
        </>
      )}
    </div>
  );
}
