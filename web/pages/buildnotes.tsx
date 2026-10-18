import { useState } from "react";
import { Callout, Card, PageTitle, Table, Tag } from "@/components/ui";
import { ANALOGY, ARCHITECTURE, CONTRACTS, COVERAGE_ALTERNATIVES, DATA_STAGES, GATES, METRICS, NOT_CLAIMED, PRIMARY_QUESTION, REPO_TREE, REPORT_TEMPLATE, SCOPE, STATUS, SUB_QUESTIONS, TECH_DECISIONS } from "@/content/docs";

const TABS = ["Research question", "Metrics", "Model & analogy", "Architecture", "NOT claimed", "Status & scope"] as const;

export default function DocsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Research question");
  return (
    <div className="space-y-4">
      <PageTitle title="Build Notes — definitions, architecture, honest status" sub="The engineering record behind the lab: exact metric definitions (13 points each), where the soccer-to-factory analogy holds and breaks, how it is built, and what is NOT claimed. For explanations in plain language use the Study Guide and Help pages." />
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm ${tab === t ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{t}</button>)}
      </div>

      {tab === "Research question" && (
        <>
          <Card title="Primary research question"><p className="text-base text-slate-900">{PRIMARY_QUESTION}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{SUB_QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul></Card>
          <Card title="Evidence classification (used throughout)"><div className="flex flex-wrap gap-2 text-xs">{(["MEASURED", "OBSERVED", "CALCULATED", "SIMULATED", "ESTIMATED", "ASSUMED", "HYPOTHESIZED", "EXTERNAL FACT", "FUTURE WORK"] as const).map((k) => <Tag key={k} kind={k} />)}</div><p className="mt-2 text-xs text-slate-600">A statement never silently changes class. Example: a coverage value from the simulator is SIMULATED; a marker position from your uploaded photo is MEASURED; a speed parameter is ASSUMED until calibrated (then ESTIMATED).</p></Card>
          <Card title="Experiment report template (Section 55)"><ol className="list-decimal pl-5 text-sm text-slate-700">{REPORT_TEMPLATE.map((r) => <li key={r}>{r}</li>)}</ol></Card>
        </>
      )}

      {tab === "Metrics" && (
        <>
          {METRICS.map((m) => (
            <Card key={m.name} title={m.name}>
              <dl className="grid gap-x-6 gap-y-2 text-xs md:grid-cols-2">
                {([["Plain language", m.plain], ["Mathematical definition", m.math], ["Units", m.units], ["Required inputs", m.inputs], ["Calculation method", m.calc], ["Why appropriate", m.why], ["What it measures", m.measures], ["What it does NOT measure", m.notMeasures], ["Assumptions", m.assumptions], ["Limitations", m.limitations], ["Sensitivity to measurement error", m.sensitivity], ["Visualisation", m.viz]] as const).map(([k, v]) => (
                  <div key={k}><dt className="font-semibold text-slate-700">{k}</dt><dd className="text-slate-600">{v}</dd></div>
                ))}
              </dl>
            </Card>
          ))}
          <Card title="Technical decision: which spatial-coverage definition?"><Table dense headers={COVERAGE_ALTERNATIVES.headers} rows={COVERAGE_ALTERNATIVES.rows} /></Card>
        </>
      )}

      {tab === "Model & analogy" && (
        <>
          <Card title="Where the soccer ↔ facility analogy is valid"><Table dense headers={["Soccer", "Facility", "Why the shared mathematics applies"]} rows={ANALOGY.valid} /></Card>
          <Card title="Where the analogy breaks down"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{ANALOGY.breaks.map((b) => <li key={b}>{b}</li>)}</ul><Callout kind="warn" title="Rule">Soccer and a factory are not identical systems. The transfer is methodological: definitions, units and algorithms are shared; conclusions are not.</Callout></Card>
        </>
      )}

      {tab === "Architecture" && (
        <>
          <Card title="Layers"><pre className="overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">{ARCHITECTURE}</pre></Card>
          <Card title="Repository structure"><pre className="overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">{REPO_TREE}</pre></Card>
          <Card title="Data contracts & module interfaces"><Table dense headers={["Module", "Contract"]} rows={CONTRACTS} /></Card>
          <Card title="Data architecture (raw → published)"><Table dense headers={["Stage", "Content", "Implementation"]} rows={DATA_STAGES} /></Card>
          <Card title="Technology decisions (identify → compare → select → justify)"><Table dense headers={TECH_DECISIONS.headers} rows={TECH_DECISIONS.rows} /></Card>
          <Card title="Resources & performance"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700"><li>Heavy work runs in the browser; the 1 vCPU server only stores records, so a Docker server is optional.</li><li>Cost per simulation ≈ 20–40 ms (24×16 grid, 120 samples). Compare: trials × scenarios; Monte Carlo: 2 per trial; sensitivity: 11 parameters × 4 levels × seeds × 2.</li><li>Grid resolution is reduced to 0.75× in batch experiments (documented; does not change definitions).</li></ul></Card>
          <Card title="Security & configuration"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700"><li>No secrets in the client. Optional AI uses {"{OPENAI_API_KEY}"}, {"{AI_BASE_URL}"}, {"{AI_MODEL}"} on the server only; the explanation route validates input length.</li><li>The experiments API validates kind/mode/stage and payload size (3 MB); stored JSON is never executed. Records are append-only.</li></ul></Card>
        </>
      )}

      {tab === "NOT claimed" && (
        <Card title="What this model does NOT claim"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">{NOT_CLAIMED.map((n) => <li key={n}>{n}</li>)}</ul></Card>
      )}

      {tab === "Status & scope" && (
        <>
          <Card title="Definition of Done — honest feature status"><Table dense headers={["Feature", "Implemented", "Tested", "Validated", "Documented", "Status"]} rows={STATUS} /><p className="mt-2 text-xs text-slate-500">“Validated” means compared against reality or external data. Verification against hand-derived cases is shown separately.</p></Card>
          <Card title="Gated development"><Table dense headers={["Gate", "Where", "State"]} rows={GATES} /></Card>
          <Card title="Scope tiers"><div className="grid gap-3 md:grid-cols-3">{([["CORE", SCOPE.core], ["ADVANCED", SCOPE.advanced], ["EXPERIMENTAL EXTENSION", SCOPE.experimental]] as const).map(([k, v]) => <div key={k}><div className="text-xs font-bold text-slate-700">{k}</div><ul className="list-disc pl-5 text-xs text-slate-600">{v.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</div></Card>
        </>
      )}
    </div>
  );
}
