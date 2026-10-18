import { useMemo, useState } from "react";
import { useLab } from "@/components/LabContext";
import { Callout, Card, PageTitle, SaveButton, Table, Tag, saveExperiment } from "@/components/ui";
import { useCoachContext } from "@/components/Coach";
import { Link } from "@/lib/router";
import { FACILITY_FORMATIONS, LAYOUTS, SOCCER_FORMATIONS, getEnvironment } from "@/engine/environments";
import { avgSeries, runSimulation } from "@/engine/sim";
import { computeIntro, defaultAgents, flowDistance } from "@/engine/intro";
import { stableHash } from "@/engine/rng";
import type { Environment, Formation } from "@/engine/types";

interface Row {
  id: string;
  name: string;
  description: string;
  env: Environment;
  /** product flow distance (facility only); NaN on a pitch, where there is no product to move */
  flow: number;
  straight: number;
  /** reach: share of space an agent reaches in the reference time (Start Here model), importance-weighted */
  reach: number;
  coverage: number;
  throughput: number;
  peakUtil: number;
  persistentDead: number;
  hash: string;
}

type MeasureKey = "flow" | "reach" | "coverage" | "throughput" | "peakUtil" | "persistentDead";

function straightRoute(env: Environment) {
  const by = new Map(env.fixedSources.map((s) => [s.id, s]));
  let t = 0;
  for (let i = 0; i + 1 < env.flowRoute.length; i++) {
    const a = by.get(env.flowRoute[i])!,
      b = by.get(env.flowRoute[i + 1])!;
    t += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return t;
}

function MiniMap({ env, formation, best }: { env: Environment; formation: Formation; best?: boolean }) {
  const by = new Map(env.fixedSources.map((s) => [s.id, s]));
  const pts = env.flowRoute
    .map((id) => by.get(id)!)
    .map((s) => `${s.x},${s.y}`)
    .join(" ");
  const W = env.width,
    H = env.height;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full rounded border ${best ? "border-emerald-400" : "border-slate-300"} ${env.mode === "soccer" ? "bg-[#14532d]" : "bg-slate-200"}`}
      role="img"
      aria-label={env.mode === "soccer" ? `Pitch with the ${formation.name} shape` : `Layout ${env.layoutId}: stations, racks and product route`}
    >
      {env.mode === "soccer" && (
        <g stroke="#ffffff" strokeWidth={0.6} fill="none" opacity={0.85}>
          <rect x={0.6} y={0.6} width={W - 1.2} height={H - 1.2} />
          <line x1={W / 2} y1={0.6} x2={W / 2} y2={H - 0.6} />
          <circle cx={W / 2} cy={H / 2} r={9.15} />
          <rect x={0.6} y={H / 2 - 20.15} width={16.5} height={40.3} />
          <rect x={W - 17.1} y={H / 2 - 20.15} width={16.5} height={40.3} />
        </g>
      )}
      {env.staticBlocked.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#9a7b4f" stroke="#6b4f2a" strokeWidth={0.4} />
      ))}
      {env.mode === "facility" && <polyline points={pts} fill="none" stroke="#d97706" strokeWidth={0.6} strokeDasharray="1.6 1.2" />}
      {env.fixedSources.map((s) => (
        <g key={s.id}>
          {env.mode === "soccer" ? (
            <circle cx={s.x} cy={s.y} r={2.6} fill="none" stroke="#fde047" strokeWidth={0.9} />
          ) : (
            <>
              <rect x={s.x - 1.8} y={s.y - 1.8} width={3.6} height={3.6} fill={s.critical ? "#f59e0b" : "#fde047"} stroke="#0f172a" strokeWidth={0.3} />
              <text x={s.x} y={s.y + 0.9} fontSize={2.6} textAnchor="middle" fill="#0f172a" fontWeight="bold">
                {s.id.replace("S", "")}
              </text>
            </>
          )}
        </g>
      ))}
      {defaultAgents(env, formation.positions).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={env.mode === "soccer" ? 2.4 : 1.5} fill={env.mode === "soccer" ? "#2563eb" : "#f97316"} stroke={env.mode === "soccer" ? "#dbeafe" : "#7c2d12"} strokeWidth={0.35} />
      ))}
    </svg>
  );
}

export default function LayoutsPage() {
  const { seed, mode } = useLab();
  const isSoccer = mode === "soccer";
  const [fid, setFid] = useState(FACILITY_FORMATIONS[0].id);
  const formation = FACILITY_FORMATIONS.find((f) => f.id === fid) ?? FACILITY_FORMATIONS[0];

  const rows: Row[] = useMemo(() => {
    if (isSoccer) {
      const env = getEnvironment("soccer");
      return SOCCER_FORMATIONS.map((f) => {
        const r = runSimulation({ env, formation: f, params: env.defaults, seed, disturbances: [] });
        const reach = computeIntro({ env, agents: defaultAgents(env, f.positions), focus: env.focusStart, speed: 6, seconds: 3, weighted: true });
        return {
          id: f.id,
          name: f.name,
          description: f.description,
          env,
          flow: NaN,
          straight: NaN,
          reach: reach.weightedCoverage,
          coverage: avgSeries(r.series, "coverage"),
          throughput: avgSeries(r.series, "throughput"),
          peakUtil: Math.max(...r.series.map((s) => s.utilMax)),
          persistentDead: r.dead.persistentArea,
          hash: r.hash,
        };
      });
    }
    return LAYOUTS.facility.map((l) => {
      const env = getEnvironment("facility", l.id);
      const r = runSimulation({ env, formation, params: env.defaults, seed, disturbances: [] });
      const reach = computeIntro({ env, agents: defaultAgents(env, formation.positions), focus: env.focusStart, speed: env.defaults.vMax, seconds: env.defaults.responseBudget, weighted: true });
      return {
        id: l.id,
        name: l.name,
        description: l.description,
        env,
        flow: flowDistance(env),
        straight: straightRoute(env),
        reach: reach.weightedCoverage,
        coverage: avgSeries(r.series, "coverage"),
        throughput: avgSeries(r.series, "throughput"),
        peakUtil: Math.max(...r.series.map((s) => s.utilMax)),
        persistentDead: r.dead.persistentArea,
        hash: r.hash,
      };
    });
  }, [isSoccer, formation, seed]);

  const best = (k: MeasureKey, dir: "min" | "max") => {
    const vals = rows.map((r) => r[k]).filter((v) => Number.isFinite(v));
    if (!vals.length) return undefined;
    const target = dir === "min" ? Math.min(...vals) : Math.max(...vals);
    // a tie is not a win: highlight nothing when every option scores the same
    if (Math.min(...vals) === Math.max(...vals)) return undefined;
    return rows.find((r) => r[k] === target)?.id;
  };

  const measures: { key: MeasureKey; dir: "min" | "max"; label: string }[] = isSoccer
    ? [
        { key: "reach", dir: "max", label: "Reach in 3 s, weighted (higher)" },
        { key: "coverage", dir: "max", label: "Coverage (higher)" },
        { key: "throughput", dir: "max", label: "Throughput (higher)" },
        { key: "peakUtil", dir: "min", label: "Peak utilisation (lower)" },
        { key: "persistentDead", dir: "min", label: "Persistent dead area (lower)" },
      ]
    : [
        { key: "flow", dir: "min", label: "Product flow distance (lower is better)" },
        { key: "coverage", dir: "max", label: "Coverage (higher)" },
        { key: "throughput", dir: "max", label: "Throughput (higher)" },
        { key: "peakUtil", dir: "min", label: "Peak utilisation (lower)" },
        { key: "persistentDead", dir: "min", label: "Persistent dead area (lower)" },
      ];
  const bestByKey = new Map(measures.map((m) => [m.key, best(m.key, m.dir)]));
  const winners = new Set([...bestByKey.values()].filter(Boolean) as string[]);
  const sweep = winners.size === 1 ? rows.find((r) => r.id === [...winners][0])?.name : null;

  const fmt = (r: Row, key: MeasureKey) => {
    const v = r[key];
    if (!Number.isFinite(v)) return "—";
    if (key === "flow") return `${v.toFixed(1)} m`;
    if (key === "persistentDead") return `${v.toFixed(0)} m²`;
    if (key === "peakUtil") return v.toFixed(2);
    return v.toFixed(3);
  };

  useCoachContext(
    isSoccer ? "Formations: five shapes, five measures" : "Factory Layouts: three layouts, five measures",
    isSoccer
      ? `Soccer pitch 105 x 68 m, five formations compared, seed ${seed}. SIMULATED with ASSUMED parameters. ` +
        rows
          .map(
            (r) =>
              `${r.name}: weighted reach in 3 s at 6 m/s ${r.reach.toFixed(3)}, time-average coverage ${r.coverage.toFixed(3)}, throughput ${r.throughput.toFixed(3)}, peak utilisation ${r.peakUtil.toFixed(2)}, persistent dead area ${r.persistentDead.toFixed(0)} m2`,
          )
          .join(". ") +
        `. Best reach: ${bestByKey.get("reach")}; best coverage: ${bestByKey.get("coverage")}; best throughput: ${bestByKey.get("throughput")}.`
      : `Factory floor 60 x 40 m, six stations S1 to S6 (S4 critical), operators arranged as "${formation.name}", seed ${seed}. SIMULATED with ASSUMED parameters. ` +
        rows
          .map(
            (r) =>
              `${r.name}: product flow distance ${r.flow.toFixed(1)} m (straight-line ${r.straight.toFixed(1)} m), time-average coverage ${r.coverage.toFixed(3)}, throughput ${r.throughput.toFixed(3)}, peak utilisation ${r.peakUtil.toFixed(2)}, persistent dead area ${r.persistentDead.toFixed(0)} m2`,
          )
          .join(". ") +
        `. Best flow distance: ${bestByKey.get("flow")}; best coverage: ${bestByKey.get("coverage")}; best throughput: ${bestByKey.get("throughput")}.`,
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title={isSoccer ? "Formations: five ways to stand, and no single best shape" : "Factory Layouts: does the same engine work on a factory floor?"}
        sub={
          isSoccer ? (
            <>
              The same page with the toggle on <b>⚽ Soccer</b>: five formations on the same pitch, measured five ways by the same engine. The shape with the best time-average coverage is not automatically the best on reach in 3 s, or on dead area. <b>There is no single score on purpose</b>: choosing the measure is the coaching decision — and the same is true of an operator arrangement on a floor.
            </>
          ) : (
            <>
              Step 5 of Your Five (Transfer). The soccer maths needs no changes: players become operators, the ball becomes the active job, a closed zone becomes a rack, the goal becomes the critical station. Compare three ways to arrange the same six stations and the same six operators.{" "}
              <b>There is no single score on purpose</b>: layouts win on different measures, and choosing the measure is the engineering decision.
            </>
          )
        }
        tags={["SIMULATED", "ASSUMED", "CALCULATED"]}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {isSoccer ? (
          <span className="text-xs text-slate-600">Each card is one formation on the same pitch. Flip the toggle to 🏭 Factory: the same five columns then compare three layouts with one operator arrangement. The units change; the reasoning does not.</span>
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Operators start as
              <select className="rounded border border-slate-300 px-2 py-1" value={fid} onChange={(e) => setFid(e.target.value)}>
                {FACILITY_FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-500">{formation.description}</span>
          </>
        )}
      </div>

      <div className={`grid gap-4 ${isSoccer ? "sm:grid-cols-2 lg:grid-cols-5" : "md:grid-cols-3"}`}>
        {rows.map((r) => (
          <Card key={r.id} title={r.name} right={winners.has(r.id) ? <span className="text-[11px] font-semibold text-emerald-700">wins ≥ 1 measure</span> : undefined}>
            <MiniMap env={r.env} formation={isSoccer ? (SOCCER_FORMATIONS.find((f) => f.id === r.id) ?? SOCCER_FORMATIONS[0]) : formation} best={winners.has(r.id)} />
            <p className="mt-2 text-xs text-slate-600">{r.description}</p>
          </Card>
        ))}
      </div>

      <Card title="Five measures, side by side" right={<Tag kind="SIMULATED" />}>
        <Table
          headers={["", ...measures.map((m) => m.label)]}
          rows={rows.map((r) => [
            r.name,
            ...measures.map((m) => {
              const isBest = bestByKey.get(m.key) === r.id;
              return (
                <span key={m.key} className={isBest ? "rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800" : ""}>
                  {fmt(r, m.key)}
                  {m.key === "flow" && Number.isFinite(r.straight) ? <span className="ml-1 text-[11px] font-normal text-slate-500">straight line {r.straight.toFixed(1)} m</span> : null}
                </span>
              );
            }),
          ])}
        />
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
          {isSoccer ? (
            <>
              <li>
                <b>Reach in 3 s</b>: the Start Here number — how much of the pitch an agent gets to in 3 seconds at 6 m/s, counting the areas near the ball and our own goal as more important. Open <Link href="/" className="text-indigo-700 underline">Start Here</Link> to move the players yourself.
              </li>
              <li>
                <b>Coverage, throughput, utilisation, dead area</b>: measured over a 60-second run in which the players chase the ball.
              </li>
            </>
          ) : (
            <>
              <li>
                <b>Flow distance</b>: metres one unit of product walks through S1 → S6, going <i>around</i> the racks. It can never be shorter than the straight line.
              </li>
              <li>
                <b>Coverage, throughput, utilisation, dead area</b> are the same measures as in <Link href="/lab" className="text-indigo-700 underline">The Lab</Link>, averaged over a 120-second run in which operators chase the active job between stations.
              </li>
            </>
          )}
          <li>Green = best of these on that measure. If the wins are split, say so: “this shape covers more, that one keeps the players less overloaded”.</li>
          {sweep && <li className="font-medium text-amber-800">One option ({sweep}) wins every measure with these settings. Do not stop there: change the seed or the arrangement and see whether it still wins. A result that depends on an assumption is a finding about the assumption.</li>}
        </ul>
        <div className="mt-3">
          <SaveButton
            onSave={() =>
              saveExperiment({
                kind: "layouts",
                stage: "analysis-output",
                mode,
                title: isSoccer ? `Formation comparison · seed ${seed}` : `Layout comparison · operators ${formation.name} · seed ${seed}`,
                config: isSoccer ? { seed, formations: rows.map((r) => r.id) } : { formationId: fid, seed, layouts: rows.map((r) => r.id) },
                summary: rows.map((r) => ({ id: r.id, flow: Number.isFinite(r.flow) ? r.flow : null, reach: r.reach, coverage: r.coverage, throughput: r.throughput, peakUtil: r.peakUtil, persistentDead: r.persistentDead })),
                hash: stableHash(rows.map((r) => r.hash + (Number.isFinite(r.flow) ? r.flow.toFixed(3) : r.reach.toFixed(4)))),
                seed,
                trials: 1,
              })
            }
          />
        </div>
      </Card>

      <Callout kind="warn" title="Where soccer and a factory are NOT the same (say this before anyone asks)">
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          <li>A factory has an order of steps (S2 cannot start before S1 finishes) and queues of work waiting. This model has neither: demand just appears around the active job.</li>
          <li>Opponents are clever and react. Rush orders and breakdowns are not.</li>
          <li>Safety rules, shift patterns and material handling (forklifts, conveyors) are outside this model.</li>
          <li>A missed ball and a missed order cost different things, so numbers are not comparable across modes. The methods transfer; the conclusions do not.</li>
        </ul>
      </Callout>
    </div>
  );
}
