/**
 * Computer-vision measurement pipeline (pure TS, works on RGBA buffers; no OpenCV needed).
 * camera -> image -> colour mask (HSV) -> connected components -> centroid -> homography -> field coordinates
 * -> quality control -> uncertainty.
 * Pixel convention: pixel (i, j) has its centre at coordinates (i, j). Field coordinates: metres or cm, origin top-left, y down.
 *
 * Uncertainty is NOT collapsed into one percentage. Kept separate:
 *  - detection quality (heuristic shape score in [0,1], NOT a probability)
 *  - positional uncertainty (pixel sigma propagated through the homography, 1-sigma, field units)
 *  - calibration residual (RMS reprojection error of held-out control points)
 *  - repeatability (empirical std of repeated frames of a static scene)
 */
import { mulberry32, gaussian } from "./rng";

export interface Pt {
  x: number;
  y: number;
}
export type Mat3 = number[];
export interface Img {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("Singular system: calibration points are degenerate (collinear?)");
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Homography H (3x3, row-major, h22 = 1) with dst ~ H * src, least squares over >= 4 point pairs. */
export function solveHomography(src: Pt[], dst: Pt[]): Mat3 {
  if (src.length < 4 || src.length !== dst.length) throw new Error("Need >= 4 matching point pairs");
  const AtA = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const Atb = new Array<number>(8).fill(0);
  const add = (row: number[], v: number) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * v;
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
    }
  };
  src.forEach((s, i) => {
    const d = dst[i];
    add([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y], d.x);
    add([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y], d.y);
  });
  const h = solveLinear(AtA, Atb);
  return [...h, 1];
}

export function applyH(H: Mat3, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

export function invertH(H: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/** RMS reprojection error (field units) of control points. With exactly 4 points this is trivially ~0 and is NOT evidence of accuracy. */
export function calibrationResidual(H: Mat3, px: Pt[], field: Pt[]): number {
  if (!px.length) return NaN;
  return Math.sqrt(px.reduce((s, p, i) => s + (applyH(H, p).x - field[i].x) ** 2 + (applyH(H, p).y - field[i].y) ** 2, 0) / px.length);
}

/** Propagate isotropic pixel sigma through the homography (numerical Jacobian): returns 1-sigma field uncertainty. */
export function propagateSigma(H: Mat3, p: Pt, sigmaPx: number): { sx: number; sy: number; radial: number } {
  const e = 0.5;
  const f0x = applyH(H, { x: p.x + e, y: p.y }), f1x = applyH(H, { x: p.x - e, y: p.y });
  const f0y = applyH(H, { x: p.x, y: p.y + e }), f1y = applyH(H, { x: p.x, y: p.y - e });
  const j11 = (f0x.x - f1x.x) / (2 * e), j21 = (f0x.y - f1x.y) / (2 * e);
  const j12 = (f0y.x - f1y.x) / (2 * e), j22 = (f0y.y - f1y.y) / (2 * e);
  const sx = sigmaPx * Math.hypot(j11, j12), sy = sigmaPx * Math.hypot(j21, j22);
  return { sx, sy, radial: Math.hypot(sx, sy) };
}

export function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

export interface ColorSpec {
  name: string;
  hMin: number;
  hMax: number;
  sMin: number;
  vMin: number;
}
export const DEFAULT_COLORS: Record<string, ColorSpec> = {
  red: { name: "red", hMin: 345, hMax: 15, sMin: 0.5, vMin: 0.35 },
  blue: { name: "blue", hMin: 200, hMax: 260, sMin: 0.5, vMin: 0.3 },
  yellow: { name: "yellow", hMin: 45, hMax: 70, sMin: 0.5, vMin: 0.5 },
};
const inHue = (h: number, a: number, b: number) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

export interface Blob {
  cx: number;
  cy: number;
  area: number;
  bw: number;
  bh: number;
  quality: number;
  circularity: number;
}

export function detectBlobs(img: Img, c: ColorSpec, minArea = 12, maxArea = 5000): Blob[] {
  const { data, width: W, height: H } = img;
  const mask = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const [h, s, v] = rgb2hsv(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]);
    if (s >= c.sMin && v >= c.vMin && inHue(h, c.hMin, c.hMax)) mask[k] = 1;
  }
  const out: Blob[] = [];
  const stack = new Int32Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) {
    if (mask[k0] !== 1) continue;
    let sp = 0;
    stack[sp++] = k0;
    mask[k0] = 2;
    let area = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (sp) {
      const k = stack[--sp];
      const x = k % W, y = (k - x) / W;
      area++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[k - 1] === 1) { mask[k - 1] = 2; stack[sp++] = k - 1; }
      if (x < W - 1 && mask[k + 1] === 1) { mask[k + 1] = 2; stack[sp++] = k + 1; }
      if (y > 0 && mask[k - W] === 1) { mask[k - W] = 2; stack[sp++] = k - W; }
      if (y < H - 1 && mask[k + W] === 1) { mask[k + W] = 2; stack[sp++] = k + W; }
    }
    if (area < minArea || area > maxArea) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const circ = area / ((Math.PI / 4) * bw * bh);
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    out.push({ cx: sx / area, cy: sy / area, area, bw, bh, circularity: circ, quality: Math.min(1, circ / 0.8) * Math.min(1, aspect / 0.7) });
  }
  return out.sort((a, b) => b.area * b.quality - a.area * a.quality);
}

export type Flag = "missing" | "low_quality" | "out_of_bounds" | "impossible_speed" | "ambiguous";
export interface Detection {
  color: string;
  px: Pt;
  field: Pt;
  quality: number;
  sigma: { sx: number; sy: number; radial: number };
  flags: Flag[];
}

export function detectMarkers(img: Img, H: Mat3, colors: { spec: ColorSpec; expected: number }[], opts: { fieldW: number; fieldH: number; sigmaPx: number; minQuality: number; minArea?: number; maxArea?: number }) {
  const dets: Detection[] = [];
  const problems: string[] = [];
  for (const { spec, expected } of colors) {
    const blobs = detectBlobs(img, spec, opts.minArea ?? 12, opts.maxArea ?? 5000);
    if (blobs.length < expected) problems.push(`${spec.name}: expected ${expected}, found ${blobs.length} (missing marker(s))`);
    if (blobs.length > expected) problems.push(`${spec.name}: ${blobs.length - expected} extra candidate blob(s) rejected (ambiguous)`);
    blobs.slice(0, expected).forEach((b) => {
      const f = applyH(H, { x: b.cx, y: b.cy });
      const flags: Flag[] = [];
      if (b.quality < opts.minQuality) flags.push("low_quality");
      if (f.x < -0.01 * opts.fieldW || f.y < -0.01 * opts.fieldH || f.x > 1.01 * opts.fieldW || f.y > 1.01 * opts.fieldH) flags.push("out_of_bounds");
      if (blobs.length > expected) flags.push("ambiguous");
      dets.push({ color: spec.name, px: { x: b.cx, y: b.cy }, field: f, quality: b.quality, sigma: propagateSigma(H, { x: b.cx, y: b.cy }, opts.sigmaPx), flags });
    });
  }
  return { detections: dets, problems };
}

export interface TrackSample {
  t: number;
  pos: Pt | null;
  quality: number;
}
/** Frame-level quality control for one marker's track: missing / low quality / out of bounds / impossible jump (speed > vMax). */
export function qcTrack(track: TrackSample[], o: { vMax: number; w: number; h: number; minQuality: number }): { flags: Flag[][]; usable: number; speeds: (number | null)[] } {
  const flags: Flag[][] = [];
  const speeds: (number | null)[] = [];
  let prev: TrackSample | null = null;
  let usable = 0;
  track.forEach((s) => {
    const f: Flag[] = [];
    let sp: number | null = null;
    if (!s.pos) f.push("missing");
    else {
      if (s.quality < o.minQuality) f.push("low_quality");
      if (s.pos.x < 0 || s.pos.y < 0 || s.pos.x > o.w || s.pos.y > o.h) f.push("out_of_bounds");
      if (prev && prev.pos) {
        sp = Math.hypot(s.pos.x - prev.pos.x, s.pos.y - prev.pos.y) / (s.t - prev.t);
        if (sp > o.vMax) f.push("impossible_speed");
      }
      if (!f.length) {
        usable++;
        prev = s;
      }
    }
    flags.push(f);
    speeds.push(sp);
  });
  return { flags, usable, speeds };
}

/** Empirical repeatability: per-axis std of repeated detections of a static marker (field units). */
export function repeatability(samples: Pt[]): { sx: number; sy: number; n: number } {
  const n = samples.length;
  if (n < 2) return { sx: NaN, sy: NaN, n };
  const mx = samples.reduce((s, p) => s + p.x, 0) / n, my = samples.reduce((s, p) => s + p.y, 0) / n;
  return { sx: Math.sqrt(samples.reduce((s, p) => s + (p.x - mx) ** 2, 0) / (n - 1)), sy: Math.sqrt(samples.reduce((s, p) => s + (p.y - my) ** 2, 0) / (n - 1)), n };
}

// ---------------------------------------------------------------- synthetic scene (controlled data with KNOWN ground truth)
export const SYNTH_RGB: Record<string, [number, number, number]> = { red: [220, 40, 40], blue: [40, 70, 220], yellow: [240, 220, 40] };

export function renderSynthetic(o: { width: number; height: number; Hfield2img: Mat3; markers: { x: number; y: number; color: string }[]; radiusField: number; noise: number; seed: number }): Img {
  const { width: W, height: H } = o;
  const data = new Uint8ClampedArray(W * H * 4);
  const bg = [238, 238, 230];
  for (let k = 0; k < W * H; k++) {
    data[k * 4] = bg[0];
    data[k * 4 + 1] = bg[1];
    data[k * 4 + 2] = bg[2];
    data[k * 4 + 3] = 255;
  }
  for (const m of o.markers) {
    const c = applyH(o.Hfield2img, m);
    const cx2 = applyH(o.Hfield2img, { x: m.x + 1, y: m.y }), cy2 = applyH(o.Hfield2img, { x: m.x, y: m.y + 1 });
    const scale = Math.sqrt(Math.abs((cx2.x - c.x) * (cy2.y - c.y) - (cx2.y - c.y) * (cy2.x - c.x)));
    const r = o.radiusField * scale;
    const col = SYNTH_RGB[m.color];
    for (let j = Math.max(0, Math.floor(c.y - r - 2)); j <= Math.min(H - 1, Math.ceil(c.y + r + 2)); j++)
      for (let i = Math.max(0, Math.floor(c.x - r - 2)); i <= Math.min(W - 1, Math.ceil(c.x + r + 2)); i++) {
        const a = Math.max(0, Math.min(1, r - Math.hypot(i - c.x, j - c.y) + 0.5));
        if (a <= 0) continue;
        const k = (j * W + i) * 4;
        for (let q = 0; q < 3; q++) data[k + q] = bg[q] * (1 - a) + col[q] * a;
      }
  }
  const rng = mulberry32(o.seed);
  if (o.noise > 0) for (let k = 0; k < W * H; k++) for (let q = 0; q < 3; q++) data[k * 4 + q] = data[k * 4 + q] + gaussian(rng) * o.noise;
  return { data, width: W, height: H };
}

export interface CvValidation {
  expected: number;
  detected: number;
  rmsError: number;
  maxError: number;
  meanError: number;
  predictedSigma: number;
  observedStd: number;
  meanQuality: number;
  frames: number;
  units: string;
  calibResidualHeldOut: number;
}

/** Controlled end-to-end test: render known marker positions through a known camera, add noise, run the SAME pipeline, compare to ground truth. */
export function validateCvPipeline(seed = 1, noise = 10, frames = 8, fieldW = 42, fieldH = 29.7): { result: CvValidation; img: Img; detections: Detection[]; truth: { x: number; y: number; color: string }[]; H: Mat3 } {
  const corners = [{ x: 70, y: 60 }, { x: 580, y: 48 }, { x: 610, y: 430 }, { x: 40, y: 420 }];
  const field = [{ x: 0, y: 0 }, { x: fieldW, y: 0 }, { x: fieldW, y: fieldH }, { x: 0, y: fieldH }];
  const Htrue = solveHomography(corners, field), Hf2i = invertH(Htrue);
  const rng = mulberry32(seed);
  // The user clicks the 4 corners imperfectly: simulate +-1.5 px click noise => the pipeline uses the ESTIMATED calibration.
  const clicked = corners.map((c) => ({ x: c.x + gaussian(rng) * 1.5, y: c.y + gaussian(rng) * 1.5 }));
  const Hi2f = solveHomography(clicked, field);
  const truth: { x: number; y: number; color: string }[] = [];
  const spec: [string, number][] = [["red", 5], ["blue", 5], ["yellow", 1]];
  for (const [color, n] of spec) for (let i = 0; i < n; i++) truth.push({ x: fieldW * (0.08 + 0.84 * rng()), y: fieldH * (0.1 + 0.8 * rng()), color });
  const errs: number[] = [], qs: number[] = [], sig: number[] = [];
  const perMarker: Pt[][] = truth.map(() => []);
  let img = renderSynthetic({ width: 640, height: 480, Hfield2img: Hf2i, markers: truth, radiusField: 0.8, noise, seed });
  let dets: Detection[] = [];
  let detected = 0;
  for (let f = 0; f < frames; f++) {
    img = renderSynthetic({ width: 640, height: 480, Hfield2img: Hf2i, markers: truth, radiusField: 0.8, noise, seed: seed * 1000 + f });
    const r = detectMarkers(img, Hi2f, spec.map(([name, n]) => ({ spec: DEFAULT_COLORS[name], expected: n })), { fieldW, fieldH, sigmaPx: 0.3, minQuality: 0.5 });
    dets = r.detections;
    detected += dets.length;
    for (const d of dets) {
      let bi = -1, bd = Infinity;
      truth.forEach((t, i) => {
        if (t.color !== d.color) return;
        const e = Math.hypot(t.x - d.field.x, t.y - d.field.y);
        if (e < bd) {
          bd = e;
          bi = i;
        }
      });
      if (bi >= 0) {
        errs.push(bd);
        perMarker[bi].push(d.field);
      }
      qs.push(d.quality);
      sig.push(d.sigma.radial);
    }
  }
  const stds = perMarker.map((s) => repeatability(s)).filter((s) => s.n > 1).map((s) => Math.hypot(s.sx, s.sy));
  const held = [{ x: 325, y: 240 }, { x: 150, y: 120 }, { x: 500, y: 300 }];
  const heldField = held.map((p) => applyH(Htrue, p));
  return {
    result: {
      expected: truth.length * frames, detected,
      rmsError: Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / Math.max(1, errs.length)),
      maxError: Math.max(0, ...errs), meanError: errs.reduce((s, e) => s + e, 0) / Math.max(1, errs.length),
      predictedSigma: sig.reduce((s, e) => s + e, 0) / Math.max(1, sig.length),
      observedStd: stds.reduce((s, e) => s + e, 0) / Math.max(1, stds.length),
      meanQuality: qs.reduce((s, e) => s + e, 0) / Math.max(1, qs.length), frames, units: "field units (cm for the default 42 x 29.7 cm sheet)",
      calibResidualHeldOut: calibrationResidual(Hi2f, held, heldField),
    },
    img, detections: dets, truth, H: Hi2f,
  };
}
