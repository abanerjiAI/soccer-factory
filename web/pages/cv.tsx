import { useEffect, useMemo, useRef, useState } from "react";
import { useLab } from "@/components/LabContext";
import { Btn, Callout, Card, PageTitle, SaveButton, Slider, Stat, Table, Tag, saveExperiment } from "@/components/ui";
import { DEFAULT_COLORS, calibrationResidual, detectMarkers, solveHomography, validateCvPipeline } from "@/engine/cv";
import type { Detection, Img, Mat3, Pt } from "@/engine/cv";
import { stableHash } from "@/engine/rng";
import type { Formation } from "@/engine/types";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const CORNER_NAMES = ["top-left", "top-right", "bottom-right", "bottom-left"];

function toCanvas(img: Img, cv: HTMLCanvasElement) {
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext("2d")!;
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
}

export default function CvPage() {
  const { mode, setCustomFormation } = useLab();
  // ---- synthetic validation
  const [noise, setNoise] = useState(10);
  const [frames, setFrames] = useState(8);
  const [synSeed, setSynSeed] = useState(1);
  const syn = useMemo(() => validateCvPipeline(synSeed, noise, frames), [synSeed, noise, frames]);
  const synRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!synRef.current) return;
    toCanvas(syn.img, synRef.current);
    const ctx = synRef.current.getContext("2d")!;
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 2;
    syn.detections.forEach((d) => {
      ctx.beginPath();
      ctx.arc(d.px.x, d.px.y, 14, 0, 7);
      ctx.stroke();
    });
  }, [syn]);

  // ---- physical image
  const imgRef = useRef<HTMLCanvasElement>(null);
  const raw = useRef<Img | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [sheet, setSheet] = useState({ w: 42, h: 29.7 });
  const [counts, setCounts] = useState({ blue: 10, red: 10, yellow: 1 });
  const [minQ, setMinQ] = useState(0.5);
  const [sigmaPx, setSigmaPx] = useState(0.5);
  const [result, setResult] = useState<{ detections: Detection[]; problems: string[] } | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [msg, setMsg] = useState("");

  const H: Mat3 | null = useMemo(() => {
    if (corners.length < 4) return null;
    try {
      return solveHomography(corners, [{ x: 0, y: 0 }, { x: sheet.w, y: 0 }, { x: sheet.w, y: sheet.h }, { x: 0, y: sheet.h }]);
    } catch {
      return null;
    }
  }, [corners, sheet]);

  useEffect(() => {
    const cv = imgRef.current;
    if (!cv || !raw.current) return;
    toCanvas(raw.current, cv);
    const ctx = cv.getContext("2d")!;
    corners.forEach((c, i) => {
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(CORNER_NAMES[i], c.x + 8, c.y - 8);
    });
    result?.detections.forEach((d) => {
      ctx.strokeStyle = d.flags.length ? "#f59e0b" : "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.px.x, d.px.y, 12, 0, 7);
      ctx.stroke();
    });
  }, [loaded, corners, result]);

  const loadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 1000 / im.width);
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(im, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      raw.current = { data: d.data, width: d.width, height: d.height };
      setCorners([]);
      setResult(null);
      setLoaded(true);
      setMsg(`Loaded ${c.width}×${c.height}px. Click the 4 pitch corners in order: top-left, top-right, bottom-right, bottom-left.`);
      URL.revokeObjectURL(url);
    };
    im.src = url;
  };

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch (e) {
      setMsg(`Webcam unavailable: ${(e as Error).message}. Use image upload instead.`);
    }
  };
  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    raw.current = { data: d.data, width: d.width, height: d.height };
    setCorners([]);
    setResult(null);
    setLoaded(true);
    setMsg("Frame captured. Click the 4 pitch corners.");
  };

  const detect = () => {
    if (!raw.current || !H) return;
    setResult(detectMarkers(raw.current, H, [{ spec: DEFAULT_COLORS.blue, expected: counts.blue }, { spec: DEFAULT_COLORS.red, expected: counts.red }, { spec: DEFAULT_COLORS.yellow, expected: counts.yellow }].filter((c) => c.expected > 0), { fieldW: sheet.w, fieldH: sheet.h, sigmaPx, minQuality: minQ }));
  };

  const useAsFormation = () => {
    const blue = result?.detections.filter((d) => d.color === "blue" && !d.flags.includes("out_of_bounds")) ?? [];
    if (!blue.length) return;
    const sorted = [...blue].sort((a, b) => a.field.x - b.field.x);
    const n = sorted.length;
    const form: Formation = {
      id: "cv-custom",
      name: `Physical setup (CV, ${n} markers)`,
      description: "Positions measured by the computer-vision pipeline from a photo of the printed pitch.",
      positions: sorted.map((d, i) => ({ role: mode === "facility" ? "OP" : i < n / 3 ? "DEF" : i < (2 * n) / 3 ? "MID" : "FWD", u: Math.min(1, Math.max(0, d.field.x / sheet.w)), v: Math.min(1, Math.max(0, d.field.y / sheet.h)) })),
    };
    setCustomFormation(form);
    setMsg(`Formation “${form.name}” added: select it in the top bar and run any experiment on it.`);
  };

  const sampleSigma = H && result ? result.detections.reduce((s, d) => s + d.sigma.radial, 0) / Math.max(1, result.detections.length) : NaN;
  const v = syn.result;

  return (
    <div className="space-y-4">
      <PageTitle title="Computer-vision measurement" sub="Pipeline: camera → image → HSV colour mask → connected components → centroid → homography → normalised field coordinates → quality control → uncertainty. Only position is extracted; velocity needs timestamped frame sequences and is computed from positions, not detected directly." tags={["SIMULATED", "CALCULATED", "MEASURED"]} />
      <Callout kind="warn" title="Evidence status">
        The synthetic test below uses rendered images with KNOWN ground truth (SIMULATED input, CALCULATED error). No physical webcam experiment has been performed by this software; physical measurements only exist if you upload your own photo below, and they are MEASURED only in that case.
      </Callout>

      <Card title="A · Controlled synthetic end-to-end test (known ground truth)" right={<Tag kind="SIMULATED" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <canvas ref={synRef} className="w-full rounded border border-slate-300" />
            <p className="mt-1 text-xs text-slate-500">Synthetic top-down photo of an A3-size sheet (42 × 29.7 cm) with 5 red, 5 blue, 1 yellow marker; mild perspective; green rings = detections in the last frame.</p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Slider label="Image noise σ" min={0} max={40} step={1} value={noise} onChange={setNoise} />
              <Slider label="Frames" min={2} max={20} step={1} value={frames} onChange={setFrames} />
              <Slider label="Scene seed" min={1} max={20} step={1} value={synSeed} onChange={setSynSeed} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Detected / expected" value={`${v.detected} / ${v.expected}`} tone={v.detected === v.expected ? "good" : "bad"} sub="detection rate" />
              <Stat label="RMS position error" value={`${f(v.rmsError)} cm`} sub={`max ${f(v.maxError)} cm`} />
              <Stat label="Positional σ (predicted)" value={`${f(v.predictedSigma, 3)} cm`} sub="pixel σ propagated through H" />
              <Stat label="Repeatability (observed)" value={`${f(v.observedStd, 3)} cm`} sub="std across frames, static scene" />
              <Stat label="Held-out calibration error" value={`${f(v.calibResidualHeldOut)} cm`} sub="corner clicks ±1.5 px" />
              <Stat label="Detection quality (mean)" value={f(v.meanQuality, 2)} sub="heuristic shape score, NOT a probability" />
            </div>
            <p className="text-xs text-slate-600">Uncertainty types are kept apart: <b>detection quality</b> (shape score), <b>positional uncertainty</b> (predicted vs observed σ), <b>calibration error</b> (imperfect corner clicks), and <b>repeatability</b>. {v.rmsError > 2 * v.predictedSigma ? `In this run the RMS error (${f(v.rmsError)} cm) is ${f(v.rmsError / Math.max(v.predictedSigma, 1e-9), 1)}× the predicted random σ (${f(v.predictedSigma, 3)} cm) and the observed repeatability is ${f(v.observedStd, 3)} cm, so the error is dominated by something other than pixel noise. HYPOTHESIZED cause (not isolated): imperfect corner clicks and perspective bias of centroids. The disagreement between predicted σ and actual error is a finding about the method; report it, do not hide it.` : "Predicted σ and actual error are of similar size in this run."}{v.detected < v.expected ? ` ${v.expected - v.detected} detections were lost: randomly placed same-colour markers can touch and merge into one blob (flagged by quality control as missing/ambiguous).` : ""}</p>
          </div>
        </div>
      </Card>

      <Card title="B · Your physical experiment (upload a photo or use a webcam)" right={<Tag kind="MEASURED" title="Only if you supply real images" />}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <canvas ref={imgRef} className={`w-full rounded border border-slate-300 ${loaded ? "cursor-crosshair" : "hidden"}`} onClick={(e) => {
              if (!raw.current || corners.length >= 4) return;
              const r = e.currentTarget.getBoundingClientRect();
              setCorners((c) => [...c, { x: ((e.clientX - r.left) / r.width) * raw.current!.width, y: ((e.clientY - r.top) / r.height) * raw.current!.height }]);
            }} />
            {!loaded && <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No image loaded.</div>}
            <video ref={videoRef} className={camOn ? "w-full max-w-sm rounded" : "hidden"} muted playsInline />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
              <Btn kind="ghost" onClick={startCam}>Start webcam</Btn>
              <Btn kind="ghost" disabled={!camOn} onClick={capture}>Capture frame</Btn>
              <Btn kind="ghost" onClick={() => setCorners([])}>Reset corners</Btn>
            </div>
            <p className="text-xs text-slate-600">{msg || "Print the pitch on paper, place red/blue/yellow markers, photograph from above."} Corners set: {corners.length}/4{corners.length === 4 && !H ? " (degenerate — reset)" : ""}.</p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label>Sheet width (cm)<input type="number" className="mt-1 w-full rounded border border-slate-300 p-1" value={sheet.w} onChange={(e) => setSheet((s) => ({ ...s, w: Number(e.target.value) || 42 }))} /></label>
              <label>Sheet height (cm)<input type="number" className="mt-1 w-full rounded border border-slate-300 p-1" value={sheet.h} onChange={(e) => setSheet((s) => ({ ...s, h: Number(e.target.value) || 29.7 }))} /></label>
              {(["blue", "red", "yellow"] as const).map((c) => <label key={c}>Expected {c}<input type="number" min={0} className="mt-1 w-full rounded border border-slate-300 p-1" value={counts[c]} onChange={(e) => setCounts((s) => ({ ...s, [c]: Math.max(0, Number(e.target.value) || 0) }))} /></label>)}
            </div>
            <Slider label="Min detection quality" min={0.1} max={0.95} step={0.05} value={minQ} onChange={setMinQ} />
            <Slider label="Centroid pixel σ (assumed)" min={0.1} max={2} step={0.1} value={sigmaPx} onChange={setSigmaPx} unit="px" />
            <Btn disabled={!H} onClick={detect}>Detect markers</Btn>
            {H && <p className="text-slate-500">With exactly 4 corner points the calibration residual is trivially 0 and is NOT evidence of accuracy; click-error is the real uncertainty (see test A).</p>}
            {result && <Stat label="Mean positional σ" value={`${f(sampleSigma, 3)} cm`} sub="propagated, 1σ" />}
          </div>
        </div>
        {result && (
          <div className="mt-3 space-y-2">
            {result.problems.length > 0 && <Callout kind="warn" title="Quality-control findings">{result.problems.map((p, i) => <div key={i}>{p}</div>)}</Callout>}
            <Table dense headers={["Marker", "Pixel (x, y)", "Field (cm)", "Normalised (u, v)", "Quality", "σ (cm)", "Flags"]} rows={result.detections.map((d, i) => [`${d.color} #${i}`, `${f(d.px.x, 1)}, ${f(d.px.y, 1)}`, `${f(d.field.x, 2)}, ${f(d.field.y, 2)}`, `${f(d.field.x / sheet.w, 3)}, ${f(d.field.y / sheet.h, 3)}`, f(d.quality, 2), f(d.sigma.radial, 3), d.flags.join(", ") || "ok"])} />
            <div className="flex flex-wrap items-center gap-3">
              <Btn kind="ghost" onClick={useAsFormation}>Use blue markers as a formation in the simulator</Btn>
              <SaveButton onSave={() => saveExperiment({ kind: "cv-measurement", stage: "raw", mode, title: `CV measurement · ${result.detections.length} markers`, config: { sheet, counts, minQ, sigmaPx, corners }, summary: { detections: result.detections, problems: result.problems }, hash: stableHash(result.detections.map((d) => d.field)), seed: 0, trials: 1, uncertainty: "positional σ propagated from assumed pixel σ; calibration click error not included (see synthetic test)" })} />
              <span className="text-xs text-slate-500">Raw stage: stored append-only, never overwritten.</span>
            </div>
          </div>
        )}
      </Card>

      <Card title="C · Physical experiment protocol (design — not yet executed)" right={<Tag kind="FUTURE WORK" />}>
        <div className="grid gap-4 text-xs text-slate-700 md:grid-cols-2">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Print a pitch with four corner marks on a flat A3 sheet (or tile A4); measure the sheet to ±1 mm.</li>
            <li>Mount the webcam overhead (≥ 50 cm), fixed, locked exposure/white balance; diffuse even lighting to avoid glare.</li>
            <li>Use matte markers: blue = resource team, red = opponents, yellow = ball (distinct hues; avoid skin/wood tones).</li>
            <li>Static test: capture 30 frames of a fixed setup → repeatability (std) per marker.</li>
            <li>Accuracy test: place markers at ruler-measured points → compare to detected positions (MEASURED error vs reference).</li>
            <li>Movement test: move one marker by a known distance in a known time (metronome) → check speed ≈ distance / time (needs timestamps).</li>
            <li>Record each session as a RAW record, then analyse in the simulator (formation import) — never overwrite raw data.</li>
          </ol>
          <div className="space-y-1">
            <p><b>Reliably extractable:</b> marker position, static formation structure, spacing, and (with timestamped frames) velocity and trajectory.</p>
            <p><b>Not claimed:</b> acceleration from webcam frame rates (differentiating noisy positions twice amplifies noise), player identity, response time without a defined trigger event.</p>
            <p><b>Known failure modes:</b> glare, shadows, similar hues, markers touching (blobs merge → flagged ambiguous), lens distortion (not corrected), camera not rigid.</p>
            <p><b>ESP32 / Pico:</b> not used. A webcam plus this pipeline solves the measurement problem; a microcontroller would add complexity without a research benefit.</p>
          </div>
        </div>
      </Card>

      <Card title="D · Public tracking data (sources verified; NOT integrated)" right={<Tag kind="EXTERNAL FACT" />}>
        <Table dense headers={["Source", "Verified facts (read from the project README)", "Terms", "Limitation / status"]} rows={[
          ["Metrica Sports sample-data (GitHub)", "Anonymised tracking + events for sample games; coordinates normalised 0–1, origin top-left, pitch 105 × 68 m; Game 3 in EPTS FIFA format.", "README asks users to be responsible and to acknowledge the source if used publicly. No formal licence text was read — check the repository before redistributing.", "Not ingested. Few games; not representative of all soccer. Sampling rate must be read from the files before use."],
          ["SkillCorner open data (GitHub)", "10 A-League 2024/25 matches; broadcast-derived tracking at 10 fps; metres, origin at pitch centre; includes extrapolated (non-detected) positions flagged by is_detected.", "README requests crediting SkillCorner. Verify the LICENSE file before use.", "Not ingested. Broadcast tracking has extrapolated positions and different coordinate conventions: convert before comparison."],
        ]} />
        <p className="mt-2 text-xs text-slate-500">Planned use (FUTURE WORK): estimate realistic speed/acceleration distributions to replace ASSUMED parameters, and test whether simulated coverage dynamics resemble real tracking. No claim is made that either dataset represents all soccer.</p>
      </Card>
    </div>
  );
}
