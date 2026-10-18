import { useEffect, useState } from "react";
import { Btn, Callout, Card, PageTitle, Progress, Stat, Table, Tag } from "@/components/ui";
import { runValidationSuite } from "@/engine/validation";
import type { ValidationCase } from "@/engine/validation";

export default function ValidationPage() {
  const [cases, setCases] = useState<ValidationCase[] | null>(null);
  const [prog, setProg] = useState({ d: 0, t: 1 });
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    setCases(await runValidationSuite((d, t) => setProg({ d, t })));
    setRunning(false);
  };
  useEffect(() => {
    run();
  }, []);
  const passed = cases?.filter((c) => c.pass).length ?? 0;
  const groups = cases ? Array.from(new Set(cases.map((c) => c.group))) : [];

  return (
    <div className="space-y-4">
      <PageTitle title="Validation" sub="Two different questions. Verification: does the code do what the maths says? (controlled cases with an obvious right answer: they run below). Validation: does the model resemble reality? (a physical experiment and real match data: partly done, listed honestly further down)." tags={["CALCULATED", "SIMULATED"]} />
      <Callout kind="warn" title="What passing tests do and do not show">
        Passing means the software behaves according to its own mathematical specification (verification). It does <b>not</b> show that the model reproduces real soccer or a real facility. That requires the physical and public-data comparisons listed below, which have not been performed.
      </Callout>
      <Card title="Verification suite (runs in your browser, same code as `npx tsx --test tests/engine.test.ts`)" right={<Btn kind="ghost" disabled={running} onClick={run}>Re-run</Btn>}>
        {running && <Progress done={prog.d} total={prog.t} label="running validation cases" />}
        {cases && (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Stat label="Cases" value={String(cases.length)} />
              <Stat label="Passed" value={String(passed)} tone={passed === cases.length ? "good" : "bad"} />
              <Stat label="Failed" value={String(cases.length - passed)} tone={cases.length - passed ? "bad" : "good"} />
            </div>
            {groups.map((g) => (
              <div key={g} className="mb-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</div>
                <Table dense headers={["ID", "Controlled case", "Expected", "Observed", "Result"]} rows={cases.filter((c) => c.group === g).map((c) => [c.id, c.description, c.expected, <code key={c.id} className="text-[11px]">{c.observed}</code>, <span key="r" className={`font-bold ${c.pass ? "text-emerald-600" : "text-rose-600"}`}>{c.pass ? "PASS" : "FAIL"}</span>])} />
              </div>
            ))}
          </>
        )}
      </Card>
      <Card title="Validation ladder — honest status">
        <Table headers={["Rung of evidence", "Comparison", "Status", "Evidence class"]} rows={[
          ["1 · Verification", "Equations vs hand-derived expectations (above)", "Done in software", <Tag key="a" kind="CALCULATED" />],
          ["2 · Synthetic camera test", "Known marker positions → rendered image → pipeline → error (see Computer Vision page A)", "Done (synthetic only)", <Tag key="b" kind="SIMULATED" />],
          ["3 · Physical camera test", "Webcam + printed pitch vs ruler-measured positions", "NOT DONE — protocol written; needs your photos", <Tag key="c" kind="FUTURE WORK" />],
          ["4 · Real match data", "Speed/acceleration distributions and coverage behaviour vs real matches", "Loader and speed estimation built and checked on synthetic tracking; YOUR file on the Real Match Data page makes it real", <Tag key="d" kind="FUTURE WORK" />],
          ["5 · Model realism", "Do disturbance responses resemble real teams or facilities?", "Cannot be claimed", <Tag key="e" kind="HYPOTHESIZED" />],
        ]} />
        <p className="mt-2 text-xs text-slate-600">If a future comparison disagrees with the model, the disagreement is to be investigated (parameters? missing mechanism? measurement error?) and reported — not forced into agreement.</p>
      </Card>
    </div>
  );
}
