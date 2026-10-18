import { useCallback, useEffect, useState } from "react";
import { Btn, Callout, Card, PageTitle, Table, Tag } from "@/components/ui";
import { runStored } from "@/engine/runner";
import { api } from "@/lib/api";
import type { StoredKind } from "@/engine/runner";
import { runSimulation } from "@/engine/sim";
import { getEnvironment } from "@/engine/environments";
import type { Formation, Mode, SimParams } from "@/engine/types";

interface Row {
  id: string;
  createdAt: string;
  kind: string;
  stage: string;
  mode: string;
  title: string;
  modelVersion: string;
  softwareVersion: string;
  seed: number;
  trials: number;
  resultHash: string;
  uncertainty: string | null;
}
interface Full extends Row {
  config: Record<string, unknown>;
  summary: unknown;
}

export default function ExperimentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [full, setFull] = useState<Full | null>(null);
  const [repro, setRepro] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const load = useCallback(async () => {
    try {
      setLoadErr("");
      setRows((await api<{ experiments: Row[] }>("experiments")).experiments ?? []);
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string) => {
    setRepro("");
    try {
      setFull((await api<{ experiment: Full }>(`experiments/${id}`)).experiment);
    } catch (e) {
      setRepro(`failed: ${(e as Error).message}`);
    }
  };
  const reproduce = async () => {
    if (!full) return;
    setBusy(true);
    setRepro("re-running from stored configuration and seed…");
    try {
      let hash = "";
      if (full.kind === "simulation") {
        const c = full.config as unknown as { mode: Mode; layoutId: string; formation: Formation; params: SimParams; seed: number };
        hash = runSimulation({ env: getEnvironment(c.mode, c.layoutId), formation: c.formation, params: c.params, seed: c.seed, disturbances: [] }).hash;
      } else if (["compare", "montecarlo", "sensitivity", "optimization", "pareto", "robust", "hypothesis"].includes(full.kind)) {
        hash = (await runStored(full.kind as StoredKind, full.config)).hash;
      } else {
        setRepro("This record type (raw measurement) is stored data, not a computation; nothing to re-run.");
        setBusy(false);
        return;
      }
      setRepro(hash === full.resultHash ? `MATCH — recomputed hash ${hash} equals the stored hash. The result is reproducible from its recorded configuration.` : `MISMATCH — stored ${full.resultHash} vs recomputed ${hash}. Possible causes: different model version (${full.modelVersion} stored), different JavaScript engine rounding, or edited code. Investigate; do not ignore.`);
    } catch (e) {
      setRepro(`failed: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Experiment Log — save a run, re-run it later, compare" sub="Every saved run stores its settings, seed, model version and a fingerprint (hash) of the result. Reproduce re-runs it from the stored settings and checks the fingerprint matches: that is what makes a result checkable. Runs are tied to this browser (an anonymous id), so other visitors cannot see or delete yours. Records can be added or deleted, never edited." tags={["CALCULATED"]} />
      {loadErr && <Callout kind="warn" title="Saving is not available">{loadErr}</Callout>}
      <Card title={`Recorded experiments (${rows.length})`} right={<Btn kind="ghost" onClick={load}>Refresh</Btn>}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing saved in this browser yet. Use “Record experiment” on The Lab, What-If, Factory Layouts, Test an Idea or the Advanced pages. (Clearing browser data removes the anonymous id, so earlier runs would no longer show here.)</p>
        ) : (
          <Table dense headers={["When", "Kind", "Stage", "Mode", "Title", "Seed", "Trials", "Hash", ""]} rows={rows.map((r) => [new Date(r.createdAt).toLocaleString(), r.kind, r.stage, r.mode, r.title, r.seed, r.trials, <code key="h">{r.resultHash}</code>, <button key="o" className="text-indigo-600 underline" onClick={() => open(r.id)}>open</button>])} />
        )}
      </Card>
      {full && (
        <Card title={full.title} right={<div className="flex gap-2"><Btn disabled={busy} onClick={reproduce}>Reproduce &amp; compare hash</Btn><Btn kind="danger" onClick={async () => { if (!window.confirm("Delete this record? This cannot be undone.")) return; await api(`experiments/${full.id}`, { method: "DELETE" }); setFull(null); load(); }}>Delete</Btn></div>}>
          <div className="mb-2 flex flex-wrap gap-2 text-xs"><Tag kind="SIMULATED" /> id {full.id} · model {full.modelVersion} · software {full.softwareVersion} · seed {full.seed} · stage {full.stage}</div>
          {full.uncertainty && <p className="mb-2 text-xs text-slate-600"><b>Uncertainty:</b> {full.uncertainty}</p>}
          {repro && <Callout kind={repro.startsWith("MATCH") ? "good" : repro.startsWith("MISMATCH") || repro.startsWith("failed") ? "bad" : "info"}>{repro}</Callout>}
          <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Configuration (inputs, parameters, seed)</summary><pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{JSON.stringify(full.config, null, 1)}</pre></details>
          <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Stored result</summary><pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{JSON.stringify(full.summary, null, 1).slice(0, 20000)}</pre></details>
        </Card>
      )}
    </div>
  );
}
