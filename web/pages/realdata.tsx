import { useMemo, useState } from "react";
import { useLab } from "@/components/LabContext";
import { Histogram } from "@/components/Charts";
import { Btn, Callout, Card, PageTitle, SaveButton, Stat, Table, Tag, saveExperiment } from "@/components/ui";
import { useCoachContext } from "@/components/Coach";
import { getEnvironment } from "@/engine/environments";
import { computeIntro, reachRadius } from "@/engine/intro";
import { histogram } from "@/engine/stats";
import { stableHash } from "@/engine/rng";
import { parseMetricaCsv, snapshot, speedProfile, suggestParams, syntheticTracking, toMetricaCsv } from "@/engine/tracking";
import type { Tracking } from "@/engine/tracking";

const MAX_BYTES = 24 * 1024 * 1024;
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");

export default function RealDataPage() {
  const lab = useLab();
  const soc = useMemo(() => getEnvironment("soccer"), []);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [source, setSource] = useState("");
  const [truth, setTruth] = useState<{ vTrue: number; aTrue: number } | null>(null);
  const [warn, setWarn] = useState<string[]>([]);
  const [smooth, setSmooth] = useState(0.5);
  const [pitchW, setPitchW] = useState(105);
  const [pitchH, setPitchH] = useState(68);
  const [frame, setFrame] = useState(0);
  const [seconds, setSeconds] = useState(3);
  const [applied, setApplied] = useState("");
  const [rawText, setRawText] = useState<string | null>(null);

  const load = (text: string, label: string, pw = pitchW, ph = pitchH) => {
    const r = parseMetricaCsv(text, { W: pw, H: ph });
    setWarn(r.warnings);
    setTruth(null);
    if (!r.tracking) { setTracking(null); setSource(""); return; }
    setRawText(text);
    setTracking(r.tracking);
    setSource(`${label} · ${r.rowsRead.toLocaleString()} frames · ${r.tracking.players.length} players · ${r.tracking.fps} fps`);
    setFrame(Math.floor(r.rowsRead / 2));
    setApplied("");
  };
  const useSynthetic = () => {
    const s = syntheticTracking({ seed: 7, vTrue: 8, aTrue: 4, noise: 0.05, seconds: 90 });
    const text = toMetricaCsv(s.tracking);
    load(text, "SYNTHETIC sample (known truth)");
    setTruth({ vTrue: s.truth.vTrue, aTrue: s.truth.aTrue });
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const slice = file.size > MAX_BYTES ? file.slice(0, MAX_BYTES) : file;
    let text = await slice.text();
    if (file.size > MAX_BYTES) text = text.slice(0, text.lastIndexOf("\n"));
    load(text, file.name);
    if (file.size > MAX_BYTES) setWarn((w) => [`Only the first ${(MAX_BYTES / 1048576).toFixed(0)} MB of ${(file.size / 1048576).toFixed(0)} MB were read (about the first part of the match).`, ...w]);
  };
  const rescale = () => rawText && load(rawText, source.split(" · ")[0] || "file", pitchW, pitchH);

  const profile = useMemo(() => (tracking ? speedProfile(tracking, smooth) : null), [tracking, smooth]);
  const sug = useMemo(() => (profile ? suggestParams(profile) : null), [profile]);
  const hist = useMemo(() => (profile ? histogram(profile.speeds, 16) : []), [profile]);

  const snap = useMemo(() => (tracking ? snapshot(tracking, frame) : null), [tracking, frame]);
  const reach = useMemo(() => {
    if (!snap || !sug || snap.players.length < 3) return null;
    const speed = sug.vMax * 0.8;
    const real = computeIntro({ env: soc, agents: snap.players, focus: snap.ball ?? { x: soc.width / 2, y: soc.height / 2 }, speed, seconds, weighted: false });
    return { speed, real };
  }, [snap, sug, seconds, soc]);

  useCoachContext(
    "Real Match Data: estimating speed limits from tracking",
    tracking && profile && sug
      ? `Source: ${source}. Positions smoothed over ${smooth.toFixed(2)} s. ${profile.players.length} players, ${profile.speeds.length} speed samples, ${profile.impossible} samples above ${12} m/s dropped as glitches. ESTIMATED top speed (99.5th percentile) ${f(sug.vMax)} m/s and acceleration limit (99th percentile) ${f(sug.aMax)} m/s2. The lab currently ASSUMES ${soc.defaults.vMax} m/s and ${soc.defaults.aMax} m/s2.${truth ? ` This is SYNTHETIC data whose true limits are ${truth.vTrue} m/s and ${truth.aTrue} m/s2.` : ""} Acceleration from positions is noisy and is best read as an upper bound.`
      : "No tracking data loaded yet.",
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Real Match Data: what are real speed limits?"
        sub={<>The lab ASSUMES a top speed of {soc.defaults.vMax} m/s and an acceleration of {soc.defaults.aMax} m/s². Tracking data records where every player was, 25 times a second. Speed is just distance moved per frame, so you can <b>estimate</b> those limits from real play instead of guessing. Load a public file, or try the built-in synthetic sample whose true answer is known.</>}
        tags={["ESTIMATED", "MEASURED", "ASSUMED"]}
      />

      <Card title="1 · Load tracking data">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-slate-800">Built-in sample</div>
            <Btn onClick={useSynthetic}>Load SYNTHETIC sample (10 players, 90 s)</Btn>
            <p className="text-xs text-slate-600">Generated with a known top speed of 8 m/s and acceleration of 4 m/s², plus position noise, so you can see how close the method gets to a known answer.</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-slate-800">Your own file (Metrica Sports format)</div>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-xs" aria-label="Choose a tracking CSV file" />
            <div className="flex items-center gap-2 text-xs">
              Pitch
              <input type="number" className="w-16 rounded border border-slate-300 px-1 py-0.5" value={pitchW} onChange={(e) => setPitchW(Number(e.target.value) || 105)} /> ×
              <input type="number" className="w-16 rounded border border-slate-300 px-1 py-0.5" value={pitchH} onChange={(e) => setPitchH(Number(e.target.value) || 68)} /> m
              {rawText && <Btn kind="ghost" className="!px-2 !py-0.5 !text-xs" onClick={rescale}>apply</Btn>}
            </div>
            <p className="text-xs text-slate-600">The file stays in your browser; nothing is uploaded. Only the first 24 MB are read.</p>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Where real data comes from</div>
            <p>Metrica Sports publishes sample match data on GitHub (<code>metrica-sports/sample-data</code>): files named like <code>Sample_Game_1_RawTrackingData_Home_Team.csv</code>, coordinates 0 to 1 on a 105 × 68 m pitch.</p>
            <p><b>Check the repository’s licence and credit the source</b> before you show anything built from it. This app bundles no match data.</p>
          </div>
        </div>
        {source && <p className="mt-3 text-xs text-slate-700">Loaded: <b>{source}</b></p>}
        {warn.map((w, i) => <p key={i} className="mt-1 text-xs text-amber-800">⚠ {w}</p>)}
      </Card>

      {tracking && profile && (
        <>
          <Card title="2 · Turn positions into speed" right={<Tag kind={truth ? "SIMULATED" : "ESTIMATED"} />}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-1">
                <label className="block text-xs text-slate-600">
                  <div className="flex justify-between"><span>Smoothing window</span><span className="font-mono text-slate-900">{smooth.toFixed(2)} s</span></div>
                  <input type="range" className="w-full accent-indigo-600" min={0.04} max={1.5} step={0.02} value={smooth} onChange={(e) => setSmooth(Number(e.target.value))} />
                </label>
                <p className="text-xs text-slate-600">
                  Speed = distance moved ÷ time between frames. Every position has a little error, and dividing by a tiny time makes that error huge: with <b>no smoothing</b> you invent speed that nobody ran. Too much smoothing flattens real sprints. Drag the slider and watch the top speed move.
                </p>
                {sug ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Top speed (est.)" value={`${f(sug.vMax)} m/s`} sub={`lab assumes ${soc.defaults.vMax}`} />
                    <Stat label="Acceleration (est.)" value={`${f(sug.aMax)} m/s²`} sub={`lab assumes ${soc.defaults.aMax}`} tone="warn" />
                    {truth && <Stat label="True top speed" value={`${truth.vTrue} m/s`} sub="synthetic truth" tone="good" />}
                    {truth && <Stat label="True acceleration" value={`${truth.aTrue} m/s²`} sub="synthetic truth" tone="good" />}
                  </div>
                ) : (
                  <Callout kind="warn">Not enough usable speed samples to estimate limits.</Callout>
                )}
                {sug && <p className="text-[11px] text-slate-500">{sug.basis} Samples above 12 m/s ({profile.impossible.toLocaleString()} found) are treated as tracking glitches and dropped. Acceleration from positions is noisy: read it as an upper bound.</p>}
                {sug && (
                  <div className="space-y-1">
                    <Btn onClick={() => { if (lab.mode !== "soccer") lab.setMode("soccer"); lab.setParam("vMax", Math.round(sug.vMax * 100) / 100); if (Number.isFinite(sug.aMax)) lab.setParam("aMax", Math.round(Math.min(sug.aMax, 6) * 100) / 100); setApplied(`Applied: The Lab now uses top speed ${f(sug.vMax)} m/s and acceleration ${f(Math.min(sug.aMax, 6))} m/s² (tagged ESTIMATED from ${truth ? "synthetic" : "your"} data).`); }}>Use these in The Lab</Btn>
                    {applied && <p className="text-xs text-emerald-700">{applied}</p>}
                  </div>
                )}
              </div>
              <div className="lg:col-span-2">
                <Histogram bins={hist} xLabel="speed (m/s), all players, all frames" />
                <div className="mt-2 max-h-56 overflow-auto">
                  <Table dense headers={["Player", "Top speed (m/s)", "99th pct speed", "Max accel (m/s²)", "Distance (m)", "Missing frames"]} rows={profile.players.map((p) => [p.id, f(p.maxSpeed), f(p.p99Speed), f(p.maxAccel), f(p.distance, 0), p.missing])} />
                </div>
              </div>
            </div>
          </Card>

          {snap && (
            <Card title="3 · A real moment: how much of the pitch did this team reach?" right={<Tag kind="SIMULATED" title="Model applied to measured positions" />}>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs text-slate-600">
                    <div className="flex justify-between"><span>Moment in the file</span><span className="font-mono text-slate-900">t = {tracking.times[Math.min(frame, tracking.times.length - 1)]?.toFixed(1)} s</span></div>
                    <input type="range" className="w-full accent-indigo-600" min={0} max={tracking.times.length - 1} value={frame} onChange={(e) => setFrame(Number(e.target.value))} />
                  </label>
                  <svg viewBox={`0 0 ${tracking.pitch.W} ${tracking.pitch.H}`} className="mt-2 w-full rounded border border-slate-300 bg-emerald-800" role="img" aria-label="Positions of tracked players at the chosen moment">
                    <rect x={0.3} y={0.3} width={tracking.pitch.W - 0.6} height={tracking.pitch.H - 0.6} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={0.3} />
                    <line x1={tracking.pitch.W / 2} y1={0} x2={tracking.pitch.W / 2} y2={tracking.pitch.H} stroke="white" strokeOpacity={0.7} strokeWidth={0.3} />
                    {reach && snap.players.map((p) => <circle key={"r" + p.id} cx={p.x} cy={p.y} r={reachRadius(reach.speed, seconds)} fill="#34d399" fillOpacity={0.12} stroke="#34d399" strokeOpacity={0.5} strokeWidth={0.2} />)}
                    {snap.players.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={1.1} fill="#2563eb" stroke="white" strokeWidth={0.25} />)}
                    {snap.ball && <circle cx={snap.ball.x} cy={snap.ball.y} r={0.8} fill="#fde047" />}
                  </svg>
                </div>
                <div className="space-y-2 text-sm">
                  <label className="block text-xs text-slate-600">
                    <div className="flex justify-between"><span>Time to arrive</span><span className="font-mono text-slate-900">{seconds.toFixed(1)} s</span></div>
                    <input type="range" className="w-full accent-indigo-600" min={0.5} max={8} step={0.5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
                  </label>
                  {reach ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Stat label="Pitch reached" value={`${(reach.real.coverage * 100).toFixed(0)}%`} sub={`${snap.players.length} tracked players`} />
                        <Stat label="Worst-served spot" value={reach.real.worst ? `${reach.real.worst.d.toFixed(0)} m` : "none"} />
                      </div>
                      <p className="text-xs text-slate-600">Same Start-Here rule (reach = speed × time) but with <b>real positions</b> and a speed of 0.8 × the estimated top speed ({reach.speed.toFixed(1)} m/s). Slide through the match and watch the number change as the team stretches and compresses.</p>
                    </>
                  ) : <p className="text-xs text-slate-500">Need at least 3 tracked players and a speed estimate.</p>}
                  <SaveButton onSave={() => saveExperiment({ kind: "tracking", stage: "processed", mode: "soccer", title: `Tracking estimate · ${source.split(" · ")[0]} · smoothing ${smooth.toFixed(2)} s`, config: { source, smoothSeconds: smooth, pitch: tracking.pitch, fps: tracking.fps, synthetic: !!truth }, summary: { vMax: sug?.vMax, aMax: sug?.aMax, samples: profile.speeds.length, impossibleDropped: profile.impossible, players: profile.players.map((p) => ({ id: p.id, maxSpeed: p.maxSpeed, p99Speed: p.p99Speed })) }, hash: stableHash({ v: sug?.vMax, a: sug?.aMax, n: profile.speeds.length }), seed: 0, trials: 1, uncertainty: "Speeds come from differentiated, smoothed tracking positions; acceleration is noise-sensitive and is an upper bound. One match or one sample is not a population." })} />
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <Callout kind="warn" title="What this does NOT show">
        One team in one match is not “soccer”. Top speed over a few minutes is not a player’s true maximum. Tracking has its own errors (this app’s synthetic test shows how smoothing changes the answer). And the lab’s numbers stay SIMULATED even after you plug in an ESTIMATED speed: only the speed limit became data-based; the demand, capacity and thresholds are still assumptions.
      </Callout>
    </div>
  );
}
