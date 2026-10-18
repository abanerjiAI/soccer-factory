import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLab } from "@/components/LabContext";
import FieldCanvas, { OVERLAYS } from "@/components/FieldCanvas";
import type { Overlay } from "@/components/FieldCanvas";
import ParamPanel from "@/components/ParamPanel";
import { LineChart } from "@/components/Charts";
import { Btn, Callout, Card, PageTitle, SaveButton, Stat, Table, Tag, saveExperiment } from "@/components/ui";
import { runSimulation, BEHAVIOUR_REGISTRY, avgSeries } from "@/engine/sim";
import { hullArea, nearestNeighbour, spread, zoneOf, pathLength } from "@/engine/geometry";
import { SpatialModel } from "@/engine/spatial";
import { useCoachContext } from "@/components/Coach";

const f3 = (x: number) => x.toFixed(3);

export default function SimulationPage() {
  const { env, formation, params, seed, mode, layoutId } = useLab();
  const dp = useDeferredValue(params);
  const result = useMemo(() => runSimulation({ env, formation, params: dp, seed, disturbances: [], recordFrames: true, recordFields: true }), [env, formation, dp, seed]);
  const [idx, setIdx] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [overlay, setOverlay] = useState<Overlay>("coverage");
  const [trail, setTrail] = useState(false);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % result.frames.length), 500 / speed);
    return () => clearInterval(id);
  }, [play, speed, result]);
  const i = Math.min(idx, result.frames.length - 1);
  const frame = result.frames[i], s = result.series[i];
  const pts = useMemo(() => Array.from({ length: frame.A.length / 2 }, (_, k) => ({ x: frame.A[2 * k], y: frame.A[2 * k + 1] })), [frame]);
  const nn = nearestNeighbour(pts);
  const zones = new Array(9).fill(0);
  pts.forEach((p) => zones[zoneOf(p.x, p.y, env.width, env.height)]++);
  const travelled = pts.map((_, k) => pathLength(result.frames.slice(0, i + 1).map((f) => ({ x: f.A[2 * k], y: f.A[2 * k + 1] }))));
  const flow = useMemo(() => (env.mode === "facility" ? new SpatialModel(env, params).flowCost() : null), [env, params]);
  const t = result.series.map((m) => m.t);
  const isBn = s.capacityLoss > 0.005;
  useCoachContext(
    "The Lab: coverage, load and bottleneck",
    `${env.name} (${mode}), arrangement ${formation.name}, seed ${seed}. SIMULATED at t=${frame.t.toFixed(1)} s with ASSUMED parameters (top speed ${params.vMax} m/s, time to arrive ${params.responseBudget} s, capacity per ${env.vocab.agent} ${params.capacityPerAgent}). Soft coverage ${f3(s.coverage)}, hard coverage ${f3(s.hardCoverage)}, mean response ${s.meanResponse.toFixed(1)} s, throughput ${f3(s.throughput)}, dead area ${s.deadArea.toFixed(0)} m2 (${(s.deadDemandShare * 100).toFixed(1)}% of demand), peak utilisation ${f3(s.utilMax)} (above 1 = overloaded). ${isBn ? `Capacity bottleneck present: ${(s.capacityLoss * 100).toFixed(1)}% of demand lost to capacity; +20% capacity would add ${(s.elevationGain * 100).toFixed(1)} percentage points of throughput.` : `No capacity bottleneck; remaining shortfall ${(s.accessLoss * 100).toFixed(1)}% is access-limited.`} Time-average soft coverage ${f3(avgSeries(result.series, "coverage"))}.`,
  );

  return (
    <div className="space-y-4">
      <PageTitle title="The Lab — who is overloaded, and where is the real limit?" sub={<>Step 3 of Your Five (Constraint). Players move under speed and acceleration limits; the page measures how much of the field they reach in time, how much work each one is asked to do, and whether the real limit is distance (access) or workload (capacity). Baseline run, no disturbance. Try the overlays: Coverage, then Bottleneck.</>} tags={["SIMULATED", "ASSUMED", "CALCULATED"]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card
            title={`${env.name} · ${formation.name} · seed ${seed}`}
            right={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select className="rounded border border-slate-300 px-1 py-1" value={overlay} onChange={(e) => setOverlay(e.target.value as Overlay)}>
                  {OVERLAYS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <label className="flex items-center gap-1"><input type="checkbox" checked={trail} onChange={(e) => setTrail(e.target.checked)} />trails</label>
              </div>
            }
          >
            <FieldCanvas env={env} frame={frame} overlay={overlay} nx={result.metadata.gridNx} ny={result.metadata.gridNy} trails={trail ? result.frames.slice(0, i + 1) : undefined} deadMaps={{ persistent: result.dead.persistentMap, temporary: result.dead.temporaryMap }} />
            <p className="mt-1 text-xs text-slate-500">{OVERLAYS.find((o) => o.id === overlay)?.help} Blue = {env.vocab.agents} (resources), red = {env.vocab.opponent}, yellow = {env.vocab.focus}.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Btn onClick={() => setPlay((p) => !p)}>{play ? "Pause" : "Play"}</Btn>
              <input type="range" className="flex-1 accent-indigo-600" min={0} max={result.frames.length - 1} value={i} onChange={(e) => { setPlay(false); setIdx(Number(e.target.value)); }} />
              <span className="w-16 font-mono text-xs">t = {frame.t.toFixed(1)} s</span>
              <select className="rounded border border-slate-300 px-1 py-1 text-xs" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={1}>1× real time</option><option value={2}>2×</option><option value={5}>5×</option>
              </select>
            </div>
          </Card>
          <Card title="Over the 60 seconds">
            <LineChart x={t} xLabel="time (s)" series={[{ name: "soft coverage", y: result.series.map((m) => m.coverage) }, { name: "hard coverage (within T*)", y: result.series.map((m) => m.hardCoverage), dashed: true }, { name: "throughput", y: result.series.map((m) => m.throughput) }]} yMin={0} yMax={1} />
            <p className="mt-1 text-xs text-slate-500">Time-average soft coverage {f3(avgSeries(result.series, "coverage"))} · throughput {f3(avgSeries(result.series, "throughput"))} · max observed speed {result.metadata.maxObservedSpeed.toFixed(2)} m/s (limit {params.vMax.toFixed(2)}).</p>
          </Card>
        </div>
        <div className="space-y-3">
          <Card title={`Metrics at t = ${frame.t.toFixed(1)} s`} right={<Tag kind="SIMULATED" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Soft coverage" value={f3(s.coverage)} sub="demand-weighted" />
              <Stat label="Hard coverage" value={f3(s.hardCoverage)} sub="reach ≤ T*" />
              <Stat label="Mean response" value={`${s.meanResponse.toFixed(1)} s`} sub="p-median style" />
              <Stat label="Throughput" value={f3(s.throughput)} sub="served fraction" />
              <Stat label="Dead area" value={`${s.deadArea.toFixed(0)} m²`} sub={`${(s.deadDemandShare * 100).toFixed(1)}% of demand`} tone={s.deadArea > 0 ? "warn" : undefined} />
              <Stat label="Peak utilisation" value={f3(s.utilMax)} sub=">1 = overloaded" tone={s.utilMax > 1 ? "bad" : undefined} />
            </div>
          </Card>
          <Card title="Bottleneck explanation">
            {isBn ? (
              <Callout kind="warn" title="Capacity bottleneck present at this instant">
                Demand reachable in time exceeds the capacity of at least one {env.vocab.agent} (peak utilisation {s.utilMax.toFixed(2)}). {(s.capacityLoss * 100).toFixed(1)}% of demand is lost to capacity, not access. Raising every capacity by 20% would raise throughput by {(s.elevationGain * 100).toFixed(1)} percentage points — that marginal gain is the Theory-of-Constraints test of a bottleneck.
              </Callout>
            ) : (
              <Callout kind="good" title="No capacity bottleneck at this instant">
                Utilisation peaks at {s.utilMax.toFixed(2)} (≤ 1), so no demand is lost to capacity. Remaining shortfall ({(s.accessLoss * 100).toFixed(1)}%) is access-limited (nobody can arrive within T*), which is a dead-zone issue, not a bottleneck. A narrow-looking area is NOT a bottleneck unless demand exceeds capacity.
              </Callout>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Model-based definition; it does not prove the same region would be a bottleneck in a real facility.</p>
          </Card>
          <Card><ParamPanel /></Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Shape of the team right now (this frame)" right={<Tag kind="CALCULATED" />}>
          <div className="mb-2 grid grid-cols-3 gap-2">
            <Stat label="Mean spacing" value={`${(nn.reduce((a, b) => a + b, 0) / nn.length).toFixed(1)} m`} sub={`min ${Math.min(...nn).toFixed(1)} m`} />
            <Stat label="Spread (RMS)" value={`${spread(pts).toFixed(1)} m`} />
            <Stat label="Hull area" value={`${hullArea(pts).toFixed(0)} m²`} />
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1 text-center text-xs">
            {zones.map((z, k) => <div key={k} className="rounded bg-slate-100 py-1">zone {k}: <b>{z}</b></div>)}
          </div>
          <Table dense headers={["Agent", "Role", "x (m)", "y (m)", "distance so far (m)"]} rows={pts.map((p, k) => [k, formation.positions[k]?.role ?? "", p.x.toFixed(1), p.y.toFixed(1), travelled[k].toFixed(1)])} />
        </Card>
        <Card title="Dead zones: temporary vs persistent" right={<Tag kind="SIMULATED" />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Persistent area" value={`${result.dead.persistentArea.toFixed(0)} m²`} sub={`dead ≥50% of time and ≥ ${params.persistSeconds}s in a row`} />
            <Stat label="Temporary area" value={`${result.dead.temporaryArea.toFixed(0)} m²`} sub="dead at some time, not persistent" />
          </div>
          <p className="mt-2 text-xs text-slate-600">Switch the overlay to “Persistent vs temporary” to see where. Dead cell: coverage &lt; {params.deadCoverage} and demand ≥ ½ average cell demand. If no persistent area appears, the honest reading is that under these assumptions the system's under-coverage is transient.</p>
          {flow && (
            <div className="mt-3 border-t border-slate-200 pt-2 text-xs">
              <b>Material-flow distance (facility layout):</b> {flow.total.toFixed(1)} m per unit along {env.flowRoute.join(" → ")}.
              <div className="text-slate-500">Σ leg path lengths (restricted areas respected) — a classical layout metric. The soccer analogue (ball progression) is not defined in this version.</div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Behaviours in the model — each one exists to answer one question">
        <Table dense headers={["Behaviour", "Implemented", "Research question it lets us ask"]} rows={BEHAVIOUR_REGISTRY.map((b) => [b.name, b.implemented ? "Yes" : <Tag key={b.id} kind="FUTURE WORK" />, b.question])} />
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <SaveButton onSave={() => saveExperiment({ kind: "simulation", stage: "simulation-output", mode, title: `Baseline simulation · ${formation.name} · seed ${seed}`, config: { mode, layoutId, formation, params, seed }, summary: { series: result.series, dead: { persistentArea: result.dead.persistentArea, temporaryArea: result.dead.temporaryArea }, events: result.events, metadata: result.metadata }, hash: result.hash, seed, trials: 1 })} />
          <span>Result hash <code>{result.hash}</code> · model {result.metadata.modelVersion} · grid {result.metadata.gridNx}×{result.metadata.gridNy}</span>
        </div>
      </Card>
    </div>
  );
}
