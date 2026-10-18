import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent } from "react";
import { useLab } from "@/components/LabContext";
import { Btn, Callout, Card, PageTitle, SaveButton, Stat, Table, Tag, saveExperiment } from "@/components/ui";
import { useCoachContext } from "@/components/Coach";
import { Link } from "@/lib/router";
import { useVisited } from "@/lib/progress";
import { formationsFor } from "@/engine/environments";
import { computeIntro, defaultAgents, isFreePoint, reachRadius } from "@/engine/intro";
import { stableHash } from "@/engine/rng";
import type { Vec } from "@/engine/types";

const CW = 1100;
/** never show 100% unless EVERY spot is reached (rounding 99.6% up to 100% would hide the worst-served spot) */
const pct = (x: number) => `${(x >= 1 ? 100 : Math.min(99, Math.round(x * 100)))}%`;

type Step = "reach" | "importance";

export default function StartPage() {
  const { env, mode } = useLab();
  const formations = useMemo(() => formationsFor(mode), [mode]);
  const startPositions = useMemo(() => defaultAgents(env, formations[0].positions), [env, formations]);
  const [agents, setAgents] = useState<Vec[]>(startPositions);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState(0);
  const [focus, setFocus] = useState<Vec>({ x: env.width * 0.62, y: env.height * 0.42 });
  const [step, setStep] = useState<Step>("reach");
  const [speed, setSpeed] = useState(mode === "soccer" ? 6 : 1.4);
  const [seconds, setSeconds] = useState(mode === "soccer" ? 3 : 6);
  const [presetName, setPresetName] = useState(formations[0].name);
  const visited = useVisited();

  // a new environment (soccer <-> factory, or another layout) starts from its own default arrangement
  useEffect(() => {
    setAgents(startPositions);
    setOff(new Set());
    setSel(0);
    setSpeed(mode === "soccer" ? 6 : 1.4);
    setSeconds(mode === "soccer" ? 3 : 6);
    setFocus({ x: env.width * 0.62, y: env.height * 0.42 });
    setPresetName(formations[0].name);
  }, [startPositions, mode, env.width, env.height, formations]);

  const active = useMemo(() => agents.filter((_, i) => !off.has(i)), [agents, off]);
  const res = useMemo(() => computeIntro({ env, agents: active, focus, speed, seconds, weighted: step === "importance" }), [env, active, focus, speed, seconds, step]);
  const plain = useMemo(() => computeIntro({ env, agents: active, focus, speed, seconds, weighted: false }), [env, active, focus, speed, seconds]);
  const weightedAll = useMemo(() => computeIntro({ env, agents: active, focus, speed, seconds, weighted: true }).weightedCoverage, [env, active, focus, speed, seconds]);
  const radius = reachRadius(speed, seconds);
  const unit = mode === "soccer" ? "pitch" : "floor";
  const who = mode === "soccer" ? "player" : "operator";

  // ---- canvas -------------------------------------------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CH = Math.round((CW * env.height) / env.width);
  const sx = CW / env.width;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = mode === "soccer" ? "#14532d" : "#334155";
    ctx.fillRect(0, 0, CW, CH);
    const cs = res.cs * sx;
    let wmin = Infinity, wmax = -Infinity;
    if (step === "importance") for (let c = 0; c < res.state.length; c++) if (res.state[c] !== 2) { wmin = Math.min(wmin, res.weight[c]); wmax = Math.max(wmax, res.weight[c]); }
    for (let c = 0; c < res.state.length; c++) {
      const x = (c % res.nx) * cs, y = Math.floor(c / res.nx) * cs;
      const st = res.state[c];
      if (st === 2) { ctx.fillStyle = "#6b4f2a"; ctx.fillRect(x, y, cs + 0.5, cs + 0.5); continue; }
      const wn = step === "importance" && wmax > wmin ? (res.weight[c] - wmin) / (wmax - wmin) : 0;
      if (st === 1) { ctx.fillStyle = `rgba(52,211,153,${0.28 + 0.3 * wn})`; }
      else ctx.fillStyle = step === "importance" ? `rgba(244,63,94,${0.1 + 0.55 * wn})` : "rgba(15,23,42,0.45)";
      ctx.fillRect(x, y, cs + 0.5, cs + 0.5);
    }
    // markings
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    if (mode === "soccer") {
      ctx.strokeRect(2, 2, CW - 4, CH - 4);
      ctx.beginPath(); ctx.moveTo(CW / 2, 2); ctx.lineTo(CW / 2, CH - 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 9.15 * sx, 0, 6.283); ctx.stroke();
      const pw = 16.5 * sx, ph = 40.3 * sx;
      ctx.strokeRect(2, CH / 2 - ph / 2, pw, ph);
      ctx.strokeRect(CW - 2 - pw, CH / 2 - ph / 2, pw, ph);
    } else {
      ctx.strokeStyle = "rgba(251,191,36,0.9)";
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      const by = new Map(env.fixedSources.map((s) => [s.id, s]));
      env.flowRoute.forEach((id, i) => { const s = by.get(id)!; if (i === 0) ctx.moveTo(s.x * sx, s.y * sx); else ctx.lineTo(s.x * sx, s.y * sx); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // importance sources
    if (step === "importance" || mode === "facility") {
      ctx.textAlign = "center";
      ctx.font = "bold 14px system-ui";
      for (const s of env.fixedSources) {
        if (mode === "soccer") {
          ctx.strokeStyle = "#fde047"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x * sx + 14, s.y * sx, 12, 0, 6.283); ctx.stroke();
          ctx.fillStyle = "#fde047"; ctx.fillText("goal", s.x * sx + 36, s.y * sx - 16);
          continue;
        }
        const r = 9 + s.weight * 2.5;
        const st = res.stations.find((q) => q.id === s.id);
        ctx.fillStyle = st && !st.reached ? "#fb7185" : "#fde047";
        ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2;
        ctx.fillRect(s.x * sx - r, s.y * sx - r, 2 * r, 2 * r);
        ctx.strokeRect(s.x * sx - r, s.y * sx - r, 2 * r, 2 * r);
        ctx.fillStyle = "#0f172a";
        ctx.fillText(s.id, s.x * sx, s.y * sx + 5);
      }
    }
    // worst-served spot
    if (res.worst) {
      ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(res.worst.x * sx, res.worst.y * sx, 14, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "#f43f5e"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
      ctx.fillText("worst-served", res.worst.x * sx, res.worst.y * sx - 20);
    }
    // ball (soccer)
    if (mode === "soccer") {
      ctx.fillStyle = "#fde047"; ctx.strokeStyle = "#111827"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(focus.x * sx, focus.y * sx, 11, 0, 6.283); ctx.fill(); ctx.stroke();
    }
    // reach ring around the selected agent (soccer: exact circle)
    if (mode === "soccer" && agents[sel] && !off.has(sel)) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(agents[sel].x * sx, agents[sel].y * sx, radius * sx, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    }
    // agents
    agents.forEach((a, i) => {
      const gone = off.has(i);
      ctx.fillStyle = gone ? "#94a3b8" : mode === "soccer" ? "#2563eb" : "#f97316";
      ctx.strokeStyle = i === sel ? "#ffffff" : "#0f172a";
      ctx.lineWidth = i === sel ? 4 : 2;
      ctx.beginPath(); ctx.arc(a.x * sx, a.y * sx, 17, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 17px system-ui"; ctx.textAlign = "center";
      ctx.fillText(gone ? "×" : String(i + 1), a.x * sx, a.y * sx + 6);
    });
  }, [res, agents, off, sel, focus, step, mode, env, CH, sx, radius]);

  const drag = useRef<{ kind: "agent" | "ball"; i: number } | null>(null);
  const toField = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * env.width, y: ((e.clientY - r.top) / r.height) * env.height, scale: r.width / CW };
  };
  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const p = toField(e);
    const hit = 24 / (sx * p.scale);
    if (mode === "soccer" && Math.hypot(p.x - focus.x, p.y - focus.y) < hit) { drag.current = { kind: "ball", i: -1 }; e.currentTarget.setPointerCapture(e.pointerId); return; }
    let best = -1, bd = hit;
    agents.forEach((a, i) => { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { setSel(best); drag.current = { kind: "agent", i: best }; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); }
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toField(e);
    const x = Math.min(env.width, Math.max(0, p.x)), y = Math.min(env.height, Math.max(0, p.y));
    if (d.kind === "ball") { setFocus({ x, y }); return; }
    if (!isFreePoint(env, x, y)) return; // refuse to drop an operator inside a rack
    setAgents((as) => as.map((a, i) => (i === d.i ? { x, y } : a)));
    setPresetName("your own");
  };
  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  const onDouble = (e: RPointerEvent<HTMLCanvasElement>) => {
    const p = toField(e);
    const hit = 18 / (sx * p.scale);
    agents.forEach((a, i) => { if (Math.hypot(a.x - p.x, a.y - p.y) < hit) toggle(i); });
  };
  const toggle = useCallback((i: number) => setOff((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; }), []);
  const onKey = (e: RKeyboardEvent<HTMLCanvasElement>) => {
    const step1 = e.shiftKey ? 5 : 1;
    const mv = (dx: number, dy: number) => {
      e.preventDefault();
      setAgents((as) => as.map((a, i) => { if (i !== sel) return a; const x = Math.min(env.width, Math.max(0, a.x + dx)), y = Math.min(env.height, Math.max(0, a.y + dy)); return isFreePoint(env, x, y) ? { x, y } : a; }));
      setPresetName("your own");
    };
    if (e.key === "ArrowLeft") mv(-step1, 0);
    else if (e.key === "ArrowRight") mv(step1, 0);
    else if (e.key === "ArrowUp") mv(0, -step1);
    else if (e.key === "ArrowDown") mv(0, step1);
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); setSel((s) => (s + 1) % agents.length); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(sel); }
  };

  const applyFormation = (name: string) => {
    const f = formations.find((q) => q.name === name);
    if (!f) return;
    setAgents(defaultAgents(env, f.positions));
    setOff(new Set());
    setPresetName(f.name);
  };
  const bunch = () => {
    const c = { x: env.width * 0.5, y: env.height * 0.5 };
    const ring = defaultAgents(env, agents.map((_, i) => ({ u: 0.5 + 0.015 * Math.cos((i / agents.length) * 6.283) * (mode === "soccer" ? 1 : 2), v: 0.5 + 0.02 * Math.sin((i / agents.length) * 6.283) * (mode === "soccer" ? 1 : 2) })));
    void c;
    setAgents(ring);
    setOff(new Set());
    setPresetName("bunched up");
  };

  const covered = res.coverage, weighted = res.weightedCoverage;
  const unreachedStations = res.stations.filter((s) => !s.reached);
  const sentence =
    step === "reach"
      ? `With ${active.length} ${who}s placed like this, someone can get to ${pct(covered)} of the ${unit} within ${seconds.toFixed(1)} s (${speed} m/s × ${seconds.toFixed(1)} s = ${radius.toFixed(1)} m${mode === "facility" ? " of walking, around the racks" : ""}).${res.worst ? ` The hardest spot to get to is ${res.worst.d.toFixed(0)} m from the nearest ${who}.` : " Every spot is reachable in time."}`
      : `Counting every spot equally you reach ${pct(plain.coverage)} of the ${unit}, but counting the spots that matter more (${mode === "soccer" ? "around the ball and in front of your own goal" : "the stations, especially the critical S4"}) you reach ${pct(weighted)}.${weighted < plain.coverage ? " The important spots are covered worse than the average spot." : " The important spots are covered at least as well as the average spot."}`;

  useCoachContext(
    mode === "soccer" ? "Start Here: reach and importance on a pitch" : "Start Here: reach and importance on a factory floor",
    `${mode === "soccer" ? "Soccer pitch 105 x 68 m" : `Factory floor 60 x 40 m, layout ${env.layoutId}`}, ${active.length} of ${agents.length} ${who}s active, arrangement: ${presetName}. SIMULATED, ASSUMED speed ${speed} m/s and ${seconds} s to arrive, so reach radius = ${radius.toFixed(1)} m${mode === "facility" ? " measured as walking distance around racks" : ""}. Plain coverage ${pct(plain.coverage)}; importance-weighted coverage ${pct(weightedAll)}. Mean distance to the nearest ${who} ${res.meanDistance.toFixed(1)} m. ${res.worst ? `Worst-served spot is ${res.worst.d.toFixed(1)} m from the nearest ${who}.` : "No unreached spot."}${mode === "facility" ? ` Stations not reached in time: ${unreachedStations.map((s) => s.id).join(", ") || "none"}. A unit walks ${res.flowDistance?.toFixed(1)} m along the flow route S1 to S6.` : ""}`,
  );

  const five = [
    { n: 1, name: "Reach", q: "How much of the pitch can we reach in time?", href: "/", done: true },
    { n: 2, name: "Importance", q: "How much of the part that matters?", href: "/", done: step === "importance" },
    { n: 3, name: "Constraint", q: "Who is overloaded, where is the real limit?", href: "/lab", done: visited.has("/lab") },
    { n: 4, name: "Shock", q: "What do we lose after a red card, and how fast do we recover?", href: "/whatif", done: visited.has("/whatif") },
    { n: 5, name: "Transfer", q: "Does the same engine work on a factory floor?", href: "/layouts", done: visited.has("/layouts") },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title={mode === "soccer" ? "Start Here: how much of the pitch can your team reach in time?" : "Start Here: how much of the factory floor can your operators reach in time?"}
        sub={
          <>
            Drag the {who}s (or click one and use the arrow keys; double-click or press Space to send one off). Change how long they have to arrive. Watch the green area, the number, and the red ring on the spot that is hardest to reach.
            {mode === "soccer" ? " Drag the ball too." : " Racks are brown: nobody can stand in them, and walking paths go around them."} This is the idea engineers call <b>coverage</b>.
          </>
        }
        tags={["SIMULATED", "ASSUMED", "CALCULATED"]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300" role="tablist" aria-label="Step">
          {(
            [
              ["reach", "1 · Reach"],
              ["importance", "2 · Importance"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={step === k} onClick={() => setStep(k)} className={`px-3 py-1.5 text-sm font-medium ${step === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-600">{step === "reach" ? "Every spot counts the same." : "Spots near the ball and the goal (or the key stations) count more: red = important and NOT reached."}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              tabIndex={0}
              role="application"
              aria-label={`Interactive ${unit}. Drag ${who}s; with a ${who} selected use arrow keys to move, N to select the next one, Space to send one off.`}
              className="w-full touch-none rounded-lg border border-slate-300 bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{ aspectRatio: `${env.width} / ${env.height}` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={onDouble as unknown as React.MouseEventHandler<HTMLCanvasElement>}
              onKeyDown={onKey}
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />reached in time</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-700" />not reached</span>
              {mode === "facility" && <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#6b4f2a]" />rack (blocked)</span>}
              {mode === "facility" && <span><span className="mr-1 inline-block h-0.5 w-4 bg-amber-400 align-middle" />product route S1 → S6</span>}
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />worst-served spot</span>
            </div>
          </Card>

          <Card title="Set up the team">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Arrangement</span>
              {formations.map((f) => (
                <Btn key={f.id} kind={presetName === f.name ? "primary" : "ghost"} className="!px-2 !py-1 !text-xs" onClick={() => applyFormation(f.name)}>{f.name}</Btn>
              ))}
              <Btn kind={presetName === "bunched up" ? "primary" : "ghost"} className="!px-2 !py-1 !text-xs" onClick={bunch}>Bunch them up</Btn>
              <span className="text-slate-500">now: {presetName}</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-slate-600">
                <div className="flex justify-between"><span>Time to arrive</span><span className="font-mono text-slate-900">{seconds.toFixed(1)} s</span></div>
                <input type="range" className="w-full accent-indigo-600" min={mode === "soccer" ? 0.5 : 2} max={mode === "soccer" ? 8 : 30} step={0.5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
              </label>
              <label className="block text-xs text-slate-600">
                <div className="flex justify-between"><span>Speed {mode === "facility" ? "(walking)" : "(running)"}</span><span className="font-mono text-slate-900">{speed.toFixed(1)} m/s</span></div>
                <input type="range" className="w-full accent-indigo-600" min={mode === "soccer" ? 3 : 0.6} max={mode === "soccer" ? 9 : 2.5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              <b>reach radius = speed × time</b> = {speed.toFixed(1)} × {seconds.toFixed(1)} = <b>{radius.toFixed(1)} m</b>. A spot is “reached” if its {mode === "facility" ? "walking distance" : "distance"} to the nearest {who} is at most that. <Tag kind="ASSUMED" title="Speeds are typical values, not measured" />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {agents.map((_, i) => (
                <button key={i} onClick={() => { setSel(i); toggle(i); }} className={`rounded-full border px-2 py-0.5 text-xs ${off.has(i) ? "border-slate-300 bg-slate-100 text-slate-400 line-through" : sel === i ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-300 bg-white text-slate-700"}`} title="Click to send off / bring back">
                  {who} {i + 1}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="What you are reaching" right={<Tag kind="CALCULATED" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={`${unit} reached`} value={pct(covered)} sub={step === "reach" ? "every spot equal" : "every spot equal (plain)"} />
              {step === "importance" ? <Stat label="Important spots reached" value={pct(weighted)} sub="weighted" tone={weighted < plain.coverage ? "warn" : "good"} /> : <Stat label="Mean distance" value={`${res.meanDistance.toFixed(1)} m`} sub={`to nearest ${who}`} />}
              <Stat label="Worst-served spot" value={res.worst ? `${res.worst.d.toFixed(0)} m` : "none"} sub={res.worst ? `from nearest ${who}` : "all reached"} tone={res.worst && res.worst.d > radius * 1.8 ? "bad" : undefined} />
              <Stat label={`${who}s on`} value={`${active.length} / ${agents.length}`} />
            </div>
            <p className="mt-3 rounded-md bg-indigo-50 p-2 text-sm text-indigo-950">{sentence}</p>
            <div className="mt-2"><SaveButton onSave={() => saveExperiment({ kind: "reach", stage: "analysis-output", mode, title: `Reach · ${mode === "soccer" ? "pitch" : env.layoutId} · ${presetName} · ${seconds.toFixed(1)} s`, config: { mode, layoutId: env.layoutId, agents, off: [...off], focus, speed, seconds, step }, summary: { coverage: plain.coverage, weightedCoverage: weightedAll, meanDistance: res.meanDistance, worst: res.worst, flowDistance: res.flowDistance }, hash: stableHash({ a: active, s: speed, t: seconds, e: env.layoutId }), seed: 0, trials: 1 })} /></div>
          </Card>

          {mode === "facility" && (
            <Card title="Factory only: stations and walking" right={<Tag kind="CALCULATED" />}>
              <Table dense headers={["Station", "Importance", "Walk to nearest", "Reached?"]} rows={res.stations.map((s) => [s.critical ? `${s.id} (critical)` : s.id, s.weight.toFixed(1), Number.isFinite(s.distance) ? `${s.distance.toFixed(1)} m` : "unreachable", s.reached ? "yes" : "NO"])} />
              <p className="mt-2 text-xs text-slate-600">
                A unit of product walks <b>{res.flowDistance?.toFixed(1)} m</b> through S1 → S6 around the racks. Move the layout (top bar) to see how layout changes that number: that is <b>flow distance</b>.
              </p>
            </Card>
          )}

          <Callout kind="info" title="Try this (60 seconds)">
            <ol className="list-decimal space-y-1 pl-4 text-xs">
              <li>Press <b>Bunch them up</b>. Watch the number fall. Press <b>{formations[0].name}</b> to spread out again.</li>
              <li>Drag the time-to-arrive slider from 1 s to 6 s. Coverage can only go up: more time never hurts.</li>
              <li>Switch to <b>2 · Importance</b>. Drag the {mode === "soccer" ? "ball far from your players" : "operators away from S4"}. The plain number may stay high while the important number drops.</li>
              <li>Send one {who} off (double-click). Which one costs you the most?</li>
            </ol>
          </Callout>
        </div>
      </div>

      <Card title="Your Five: the five ideas this project is built to explain">
        <div className="grid gap-2 md:grid-cols-5">
          {five.map((f) => (
            <Link key={f.n} href={f.href} className={`rounded-lg border p-3 text-sm hover:border-indigo-400 ${f.done ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{f.n}</span>
                {f.done && <span className="text-emerald-600" aria-label="done">✓</span>}
              </div>
              <div className="font-semibold text-slate-900">{f.name}</div>
              <div className="mt-0.5 text-xs text-slate-600">{f.q}</div>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Next: <Link href="/lab" className="text-indigo-700 underline">The Lab</Link>. New to all this? Start with the <Link href="/examples" className="text-indigo-700 underline">Four Worked Examples</Link> (team sheet → red card → overload → pressing block), open the <Link href="/help" className="text-indigo-700 underline">Help</Link> page for a 10-minute guided first session, or the <Link href="/guide" className="text-indigo-700 underline">Study Guide</Link> for the ideas one by one.
        </p>
      </Card>
    </div>
  );
}
