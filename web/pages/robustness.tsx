import { useState } from "react";
import { useLab } from "@/components/LabContext";
import { Bars, Histogram, LineChart } from "@/components/Charts";
import { Btn, Callout, Card, PageTitle, Progress, SaveButton, Slider, Table, Tag, saveExperiment, useRunner } from "@/components/ui";
import { ExplainPanel } from "@/components/Coach";
import { DISTURBANCE_TYPES, referenceSuite } from "@/engine/disturbances";
import type { MCResult, SensResult } from "@/engine/experiments";
import { runStored } from "@/engine/runner";
import type { DisturbanceType } from "@/engine/types";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");

export default function RobustnessPage() {
  const { env, formation, params, seed, mode, layoutId } = useLab();
  const [trials, setTrials] = useState(40);
  const [pInc, setPInc] = useState(0.5);
  const [types, setTypes] = useState<DisturbanceType[]>(["agent_unavailable", "region_blocked", "demand_spike", "movement_slowdown", "tempo_increase", "focus_relocation"]);
  const [sTrials, setSTrials] = useState(4);
  const mc = useRunner<MCResult>();
  const se = useRunner<SensResult>();
  const [sel, setSel] = useState(0);

  const sres = se.result;
  const row = sres?.rows[sel];
  const ranked = sres ? [...sres.rows].sort((a, b) => b.rangeLoss - a.rangeLoss) : [];

  return (
    <div className="space-y-4">
      <PageTitle title="Robustness — Monte Carlo & sensitivity analysis" sub="Monte Carlo here represents uncertainty about WHICH disturbances occur, how severe, where and when (and the random focus path). It does not represent real-world player variability. Sensitivity analysis asks which assumed parameters actually drive the answer." tags={["SIMULATED", "ASSUMED"]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Monte Carlo disturbance combinations" className="lg:col-span-1">
          <div className="space-y-2">
            <Slider label="Trials" min={10} max={200} step={5} value={trials} onChange={setTrials} />
            <Slider label="P(each disturbance type present)" min={0.1} max={0.9} step={0.05} value={pInc} onChange={setPInc} />
            <div className="space-y-1 text-xs">
              {DISTURBANCE_TYPES.map((d) => (
                <label key={d.type} className="flex items-center gap-1"><input type="checkbox" checked={types.includes(d.type)} onChange={(e) => setTypes((t) => (e.target.checked ? [...t, d.type] : t.filter((x) => x !== d.type)))} />{env.vocab.disturbance[d.type]}</label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Distributions (recorded with the result): severity ~ U(0.2, 1), location ~ U(field), start ~ U(15–35% of horizon), duration ~ U(10–30% of horizon), agents failed ~ 1–3 uniformly. Cost ≈ 2 simulations per trial.</p>
            <Btn disabled={mc.running || types.length === 0} onClick={() => mc.run((p) => runStored("montecarlo", { mode, layoutId, formation, params, seed, trials, types, pInclude: pInc }, p).then((r) => r.summary as MCResult))}>Run Monte Carlo</Btn>
            {mc.running && <Progress done={mc.prog.done} total={mc.prog.total} label={mc.prog.label} />}
          </div>
        </Card>
        <Card title="Monte Carlo results" className="lg:col-span-2">
          {mc.result ? (
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Distribution of peak coverage loss</div>
                  <Histogram bins={mc.result.hist} xLabel="peak coverage loss" />
                </div>
                <div className="text-xs text-slate-700">
                  <p>n = {mc.result.trials.length} trials ({mc.result.nNoDisturbance} drew no disturbance and have zero loss by construction).</p>
                  <p>Peak loss: mean {f(mc.result.peak.mean)} (95% CI {f(mc.result.peak.lo)}–{f(mc.result.peak.hi)}), median {f(mc.result.peak.median)}, 5–95% range {f(mc.result.peak.q05)}–{f(mc.result.peak.q95)}, max {f(mc.result.peak.max)}.</p>
                  <p>Integrated loss: mean {f(mc.result.mean.mean, 4)} (95% CI {f(mc.result.mean.lo, 4)}–{f(mc.result.mean.hi, 4)}).</p>
                  <p>Among disturbed trials, recovered within the horizon in {f(mc.result.fracRecovered * 100, 0)}%; disturbance outlasting the horizon (censored) in {f(mc.result.fracCensored * 100, 0)}%.</p>
                </div>
              </div>
              <Table dense headers={["Disturbance type", "n present", "mean loss if present", "mean loss if absent", "difference [≈95% CI]", "CI excludes 0?"]} rows={mc.result.byType.map((b) => [env.vocab.disturbance[b.type], b.nWith, f(b.meanWith, 4), f(b.meanWithout, 4), `${f(b.diff, 4)} [${f(b.lo, 4)}, ${f(b.hi, 4)}]`, b.excludesZero ? "yes" : "no"])} />
              <p className="text-[11px] text-slate-500">Presence of each type is randomised independently inside the simulation, so within the model this difference is attributable to the type (not mere correlation) — but it still holds only for this model, these distributions and these assumed parameters. Seeds recorded per trial.</p>
              <SaveButton onSave={() => saveExperiment({ kind: "montecarlo", mode, title: `Monte Carlo ${mc.result!.trials.length} trials · ${formation.name}`, config: { mode, layoutId, formation, params, seed, trials, types, pInclude: pInc }, summary: mc.result!, hash: mc.result!.hash, seed, trials, uncertainty: "95% t-interval across random disturbance sets" })} />
              <ExplainPanel topic="Monte Carlo disturbance study" context={`n=${mc.result.trials.length} simulated trials. Peak coverage loss mean ${f(mc.result.peak.mean)} (95% CI ${f(mc.result.peak.lo)}-${f(mc.result.peak.hi)}); 5-95% range ${f(mc.result.peak.q05)}-${f(mc.result.peak.q95)}. Recovered in ${f(mc.result.fracRecovered * 100, 0)}% of disturbed trials.`} />
            </div>
          ) : <p className="text-xs text-slate-500">Run the Monte Carlo to see the distribution. Nothing is shown until it has actually been computed.</p>}
        </Card>
      </div>

      <Card title="Sensitivity analysis — one parameter at a time, 0.5× to 1.5×" right={<div className="flex items-center gap-2 text-xs"><span>seeds per point</span><input type="number" min={2} max={10} className="w-14 rounded border border-slate-300 px-1" value={sTrials} onChange={(e) => setSTrials(Math.max(2, Math.min(10, Number(e.target.value) || 4)))} /><Btn disabled={se.running} onClick={() => se.run((p) => runStored("sensitivity", { mode, layoutId, formation, params, seed, trials: sTrials, levels: [0.5, 0.75, 1, 1.25, 1.5], disturbances: referenceSuite(env).combined }, p).then((r) => r.summary as SensResult))}>Run sensitivity</Btn></div>}>
        {se.running && <Progress done={se.prog.done} total={se.prog.total} label={se.prog.label} />}
        {sres ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">Influence on integrated coverage loss (range across levels) under the reference combined disturbance</div>
              <Bars items={ranked.map((r) => ({ label: <button className="text-left underline decoration-dotted" onClick={() => setSel(sres.rows.indexOf(r))}>{r.label}</button>, value: r.rangeLoss, color: "#0ea5e9" }))} />
              <div className="mt-3 mb-1 text-xs font-semibold text-slate-600">Influence on baseline coverage (range)</div>
              <Bars items={[...sres.rows].sort((a, b) => b.rangeCoverage - a.rangeCoverage).map((r) => ({ label: r.label, value: r.rangeCoverage, color: "#10b981" }))} />
            </div>
            <div>
              {row && (
                <>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Parameter → response: {row.label}</div>
                  <LineChart x={row.levels} xLabel="multiple of default" series={[{ name: "baseline coverage", y: row.baseCoverage }, { name: "integrated loss", y: row.meanLoss }, { name: "peak loss", y: row.peakLoss, dashed: true }]} height={200} yMin={0} />
                  <p className="text-xs text-slate-600">Elasticity of integrated loss (±25%): {f(row.elasticityLoss, 2)}. A curve that bends or flattens indicates non-linear / threshold behaviour; inspect it before trusting the elasticity.</p>
                </>
              )}
              <Callout kind="warn">Sensitivity is local (one-at-a-time around the default) and uses {sres.config.trials} seeds per point; interactions between parameters are not explored. Parameters at the top are the ones whose assumed values most need calibration against real data.</Callout>
              <div className="mt-2"><SaveButton onSave={() => saveExperiment({ kind: "sensitivity", mode, title: `Sensitivity · ${formation.name}`, config: { mode, layoutId, formation, params, seed, trials: sTrials, levels: [0.5, 0.75, 1, 1.25, 1.5], disturbances: referenceSuite(env).combined }, summary: sres, hash: sres.hash, seed, trials: sTrials })} /></div>
            </div>
          </div>
        ) : <p className="text-xs text-slate-500">Cost ≈ 11 parameters × 4 levels × seeds × 2 simulations (about 10–40 s). Not instant; press Run.</p>}
        <Tag kind="SIMULATED" />
      </Card>
    </div>
  );
}
