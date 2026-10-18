import { useState } from "react";
import { useLab } from "@/components/LabContext";
import { Btn, Callout, Card, PageTitle, Progress, SaveButton, Slider, Table, Tag, VerdictBadge, saveExperiment, useRunner } from "@/components/ui";
import { HYPOTHESES } from "@/engine/hypotheses";
import type { HypothesisResult } from "@/engine/hypotheses";
import { runStored } from "@/engine/runner";

export default function HypothesesPage() {
  const { params, seed, mode, layoutId } = useLab();
  const [trials, setTrials] = useState(16);
  const [results, setResults] = useState<Record<string, HypothesisResult>>({});
  const [active, setActive] = useState<string>("");
  const runner = useRunner<HypothesisResult>();

  const run = async (id: string) => {
    setActive(id);
    const r = await runner.run((p) => runStored("hypothesis", { id, mode, layoutId, params, seed, trials }, p).then((x) => x.summary as HypothesisResult));
    if (r) setResults((s) => ({ ...s, [`${mode}:${id}`]: r }));
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Hypotheses — pre-registered, computed verdicts" sub="Support and contradiction criteria are fixed in source code BEFORE any run (src/engine/hypotheses.ts). Verdicts are computed from simulated data with selection and confirmation seeds kept separate. A hypothesis is never edited to obtain a result. Negative or inconclusive outcomes are displayed with equal prominence." tags={["HYPOTHESIZED", "SIMULATED"]} />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64"><Slider label="Seeds per hypothesis (≥ 8)" min={8} max={40} step={2} value={trials} onChange={setTrials} /></div>
          <span className="text-xs text-slate-500">Mode: <b>{mode}</b> — results are stored per mode. Each run takes roughly 3–15 s (not instant).</span>
        </div>
      </Card>
      {HYPOTHESES.map((h) => {
        const r = results[`${mode}:${h.id}`];
        return (
          <Card key={h.id} title={<span>{h.id} · {h.title} {r ? <VerdictBadge verdict={r.verdict} /> : <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">NOT YET RUN</span>}</span>} right={<Btn disabled={runner.running} onClick={() => run(h.id)}>Run {h.id}</Btn>}>
            <p className="text-sm text-slate-800"><b>Hypothesis.</b> {h.statement}</p>
            <div className="mt-2 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
              <div className="space-y-1">
                <p><b>Independent:</b> {h.variables.independent}</p>
                <p><b>Dependent:</b> {h.variables.dependent}</p>
                <p><b>Controls:</b> {h.variables.controls}</p>
                <p><b>Experiment:</b> {h.experiment}</p>
              </div>
              <div className="space-y-1">
                <p><b className="text-emerald-700">Supporting evidence:</b> {h.support}</p>
                <p><b className="text-rose-700">Contradicting evidence:</b> {h.contradict}</p>
                <p><b>Alternative explanations:</b> {h.alternatives.join(" ")}</p>
                <p><b>Limitations:</b> {h.limitations.join(" ")}</p>
              </div>
            </div>
            {runner.running && active === h.id && <div className="mt-2"><Progress done={runner.prog.done} total={runner.prog.total} label={runner.prog.label} /></div>}
            {r && (
              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2"><Tag kind="SIMULATED" /><span className="text-xs text-slate-500">{r.trials} seeds · hash {r.hash}</span></div>
                <ul className="list-disc pl-5 text-sm text-slate-800">{r.evidence.map((e, k) => <li key={k}>{e}</li>)}</ul>
                {r.table.rows.length > 0 && <Table dense headers={r.table.headers} rows={r.table.rows} />}
                {r.verdict !== "SUPPORTED" && <Callout kind={r.verdict === "NOT SUPPORTED" ? "bad" : "warn"} title={r.verdict === "NOT SUPPORTED" ? "Reported honestly: the hypothesis was not supported under the pre-registered criterion" : "Inconclusive under the pre-registered criterion"}>This is a valid scientific result about THIS model under ASSUMED parameters. It is not a reason to change the criterion.</Callout>}
                {r.verdict === "SUPPORTED" && <Callout kind="info">Supported within the simulation only. It says nothing yet about real soccer or real facilities (no calibration or real-data validation has been performed).</Callout>}
                <SaveButton onSave={() => saveExperiment({ kind: "hypothesis", mode, title: `${h.id}: ${r.verdict} (${mode})`, config: { id: h.id, mode, layoutId, params, seed, trials }, summary: r, hash: r.hash, seed, trials })} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
