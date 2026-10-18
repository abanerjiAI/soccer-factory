/**
 * REAL MATCH DATA (tracking) - parse, clean, and turn positions into speed / acceleration estimates.
 *
 * Supported input: Metrica Sports "sample-data" raw tracking CSV (wide format):
 *   row 1: team name,   row 2: player ids,   row 3: "Period,Frame,Time [s],<id>,,<id>,,...,Ball,"
 *   then one row per frame; each player/ball has an x column followed by a y column, normalised 0..1.
 * (Public data, licence: read the repository's licence before reusing it, and credit the source.)
 *
 * Nothing here is bundled data. The built-in "synthetic" sample is generated from a known speed limit so that the
 * pipeline can be checked against truth (same idea as the synthetic computer-vision test).
 */
import { mulberry32, gaussian } from "./rng";
import { quantile } from "./stats";

export interface TrackedPlayer {
  id: string;
  x: Float64Array; // metres, NaN = missing
  y: Float64Array;
}
export interface Tracking {
  fps: number;
  times: number[];
  players: TrackedPlayer[];
  ball: { x: Float64Array; y: Float64Array } | null;
  pitch: { W: number; H: number };
}

export interface ParseResult {
  tracking: Tracking | null;
  warnings: string[];
  rowsRead: number;
}

/** Parse Metrica wide-format CSV text. maxRows limits memory (default 60k frames = 40 min at 25 Hz). */
export function parseMetricaCsv(text: string, pitch = { W: 105, H: 68 }, maxRows = 60000): ParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const hi = lines.findIndex((l) => /^\s*Period\s*,\s*Frame/i.test(l));
  if (hi < 0) return { tracking: null, warnings: ["Could not find the header row that starts with 'Period,Frame,Time'. Is this a Metrica raw-tracking CSV?"], rowsRead: 0 };
  const header = lines[hi].split(",");
  const idRow = hi >= 1 ? lines[hi - 1].split(",") : [];
  // columns after the first three: x,y pairs. The id sits above (or on) the x column.
  const slots: { id: string; xc: number; yc: number; isBall: boolean }[] = [];
  for (let c = 3; c + 1 < header.length + 1; c += 2) {
    if (c >= header.length) break;
    const nm = (header[c] || idRow[c] || "").trim();
    if (!nm) continue;
    slots.push({ id: nm, xc: c, yc: c + 1, isBall: /ball/i.test(nm) });
  }
  if (!slots.length) return { tracking: null, warnings: ["Header row found but no player columns detected."], rowsRead: 0 };
  const rows: string[][] = [];
  for (let i = hi + 1; i < lines.length && rows.length < maxRows; i++) rows.push(lines[i].split(","));
  if (lines.length - hi - 1 > maxRows) warnings.push(`Only the first ${maxRows} frames were read (file is longer).`);
  const n = rows.length;
  const times: number[] = new Array(n);
  const players: TrackedPlayer[] = [];
  let ball: Tracking["ball"] = null;
  const mk = () => ({ x: new Float64Array(n).fill(NaN), y: new Float64Array(n).fill(NaN) });
  const cols = slots.map((s) => ({ s, a: mk() }));
  for (let r = 0; r < n; r++) {
    const row = rows[r];
    times[r] = parseFloat(row[2]);
    for (const { s, a } of cols) {
      const x = parseFloat(row[s.xc]), y = parseFloat(row[s.yc]);
      if (Number.isFinite(x) && Number.isFinite(y)) { a.x[r] = x * pitch.W; a.y[r] = y * pitch.H; }
    }
  }
  for (const { s, a } of cols) {
    if (s.isBall) ball = a;
    else players.push({ id: s.id, x: a.x, y: a.y });
  }
  const dts: number[] = [];
  for (let r = 1; r < Math.min(n, 200); r++) if (times[r] > times[r - 1]) dts.push(times[r] - times[r - 1]);
  const dt = dts.length ? quantile(dts, 0.5) : 0.04;
  const fps = dt > 0 ? Math.round(1 / dt) : 25;
  if (!Number.isFinite(times[0])) warnings.push("Time column could not be read; assuming 25 frames per second.");
  const miss = players.reduce((s, p) => s + p.x.reduce((q, v) => q + (Number.isNaN(v) ? 1 : 0), 0), 0);
  if (miss > 0) warnings.push(`${miss} missing player positions (players off the pitch or not tracked) were left empty, not guessed.`);
  return { tracking: { fps: Number.isFinite(fps) && fps > 0 ? fps : 25, times, players, ball, pitch }, warnings, rowsRead: n };
}

/** Moving-average smooth that ignores NaN. window in frames (odd). */
function smooth(a: Float64Array, w: number): Float64Array {
  if (w <= 1) return a;
  const h = Math.floor(w / 2), n = a.length, out = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(a[i])) continue;
    let s = 0, c = 0;
    for (let k = Math.max(0, i - h); k <= Math.min(n - 1, i + h); k++) if (!Number.isNaN(a[k])) { s += a[k]; c++; }
    out[i] = s / c;
  }
  return out;
}

export interface PlayerProfile {
  id: string;
  maxSpeed: number;
  p99Speed: number;
  maxAccel: number;
  p99Accel: number;
  distance: number;
  missing: number;
}
export interface SpeedProfile {
  smoothSeconds: number;
  players: PlayerProfile[];
  speeds: number[];
  accels: number[];
  impossible: number;
}
export const IMPOSSIBLE_SPEED = 12; // m/s: faster than any human sprint; treated as a tracking glitch and excluded

export function speedProfile(t: Tracking, smoothSeconds = 0.5): SpeedProfile {
  const w = Math.max(1, Math.round(smoothSeconds * t.fps) | 1);
  const dt = 1 / t.fps;
  const players: PlayerProfile[] = [];
  const allS: number[] = [], allA: number[] = [];
  let impossible = 0;
  for (const p of t.players) {
    const sx = smooth(p.x, w), sy = smooth(p.y, w);
    const n = sx.length;
    const sp = new Float64Array(n).fill(NaN);
    for (let i = 1; i < n - 1; i++) {
      if (Number.isNaN(sx[i - 1]) || Number.isNaN(sx[i + 1])) continue;
      const v = Math.hypot(sx[i + 1] - sx[i - 1], sy[i + 1] - sy[i - 1]) / (2 * dt);
      if (v > IMPOSSIBLE_SPEED) { impossible++; continue; }
      sp[i] = v;
    }
    const sps: number[] = [], acs: number[] = [];
    let dist = 0;
    // acceleration = change of the (already smoothed) speed across +-h frames; one-frame differences just amplify noise
    const h = Math.max(1, Math.round(0.25 * t.fps));
    for (let i = 1; i < n - 1; i++) {
      if (Number.isNaN(sp[i])) continue;
      sps.push(sp[i]);
      dist += sp[i] * dt;
      if (i - h >= 1 && i + h <= n - 2 && !Number.isNaN(sp[i - h]) && !Number.isNaN(sp[i + h])) acs.push(Math.abs(sp[i + h] - sp[i - h]) / (2 * h * dt));
    }
    const miss = p.x.reduce((q, v) => q + (Number.isNaN(v) ? 1 : 0), 0);
    if (sps.length < 10) { players.push({ id: p.id, maxSpeed: NaN, p99Speed: NaN, maxAccel: NaN, p99Accel: NaN, distance: 0, missing: miss }); continue; }
    players.push({ id: p.id, maxSpeed: Math.max(...sps), p99Speed: quantile(sps, 0.99), maxAccel: acs.length ? Math.max(...acs) : NaN, p99Accel: acs.length ? quantile(acs, 0.99) : NaN, distance: dist, missing: miss });
    for (const v of sps) allS.push(v);
    for (const a of acs) allA.push(a);
  }
  return { smoothSeconds, players, speeds: allS, accels: allA, impossible };
}

export interface Suggested {
  vMax: number;
  aMax: number;
  basis: string;
}
/** Estimates for the model's top speed / acceleration limits: the 99.5th percentile over all players (robust to single glitches). */
export function suggestParams(p: SpeedProfile): Suggested | null {
  if (p.speeds.length < 50) return null;
  const v = quantile(p.speeds, 0.995);
  const a = p.accels.length ? quantile(p.accels, 0.99) : NaN;
  return { vMax: v, aMax: a, basis: `99.5th percentile of ${p.speeds.length.toLocaleString()} speed samples and 99th percentile of ${p.accels.length.toLocaleString()} acceleration samples, ${p.players.filter((q) => Number.isFinite(q.maxSpeed)).length} players, positions smoothed over ${p.smoothSeconds.toFixed(2)} s.` };
}

/** Positions of all tracked (non-missing) players at the frame index nearest to time t. */
export function snapshot(t: Tracking, frame: number): { players: { id: string; x: number; y: number }[]; ball: { x: number; y: number } | null } {
  const f = Math.max(0, Math.min(t.times.length - 1, frame));
  const players = t.players.filter((p) => !Number.isNaN(p.x[f])).map((p) => ({ id: p.id, x: p.x[f], y: p.y[f] }));
  const ball = t.ball && !Number.isNaN(t.ball.x[f]) ? { x: t.ball.x[f], y: t.ball.y[f] } : null;
  return { players, ball };
}

// ---------------------------------------------------------------------------------------------------------------------
// Synthetic tracking with KNOWN truth (speed limit vTrue, acceleration limit aTrue), for pipeline checks and the demo.
// Each player chases moving waypoints under the limits; measurement noise (sigma metres) is added to the recorded positions.
export interface SyntheticOpts { seed?: number; fps?: number; seconds?: number; vTrue?: number; aTrue?: number; noise?: number; pitch?: { W: number; H: number }; players?: number }
export function syntheticTracking(o: SyntheticOpts = {}): { tracking: Tracking; truth: { vTrue: number; aTrue: number; noise: number } } {
  const seed = o.seed ?? 7, fps = o.fps ?? 25, seconds = o.seconds ?? 90, vTrue = o.vTrue ?? 8, aTrue = o.aTrue ?? 4, noise = o.noise ?? 0.05;
  const pitch = o.pitch ?? { W: 105, H: 68 }, np = o.players ?? 10;
  const rng = mulberry32(seed);
  const dt = 1 / fps, n = Math.round(seconds * fps) + 1;
  const players: TrackedPlayer[] = [];
  const homes = Array.from({ length: np }, (_, i) => ({ x: pitch.W * (0.15 + 0.5 * ((i % 5) / 4)), y: pitch.H * (i < 5 ? 0.25 : 0.75) }));
  for (let i = 0; i < np; i++) {
    const px = new Float64Array(n), py = new Float64Array(n);
    let x = homes[i].x, y = homes[i].y, vx = 0, vy = 0;
    let tx = x, ty = y, hold = 0;
    for (let k = 0; k < n; k++) {
      if (hold <= 0) {
        // mix of jogs and a few sprints so the speed distribution has a real upper tail
        const far = rng() < 0.18 ? 38 : 14;
        tx = Math.min(pitch.W - 1, Math.max(1, homes[i].x + (rng() - 0.5) * 2 * far * 1.6));
        ty = Math.min(pitch.H - 1, Math.max(1, homes[i].y + (rng() - 0.5) * 2 * far));
        hold = 1.5 + rng() * 3;
      }
      hold -= dt;
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
      const want = d < 1e-6 ? 0 : Math.min(vTrue, Math.sqrt(2 * aTrue * d));
      let ax = ((d < 1e-6 ? 0 : (dx / d) * want) - vx) / dt, ay = ((d < 1e-6 ? 0 : (dy / d) * want) - vy) / dt;
      const am = Math.hypot(ax, ay);
      if (am > aTrue) { ax *= aTrue / am; ay *= aTrue / am; }
      vx += ax * dt; vy += ay * dt;
      const sp = Math.hypot(vx, vy);
      if (sp > vTrue) { vx *= vTrue / sp; vy *= vTrue / sp; }
      x += vx * dt; y += vy * dt;
      px[k] = x + noise * gaussian(rng);
      py[k] = y + noise * gaussian(rng);
    }
    players.push({ id: `Player${i + 1}`, x: px, y: py });
  }
  const times = Array.from({ length: n }, (_, k) => k * dt);
  return { tracking: { fps, times, players, ball: null, pitch }, truth: { vTrue, aTrue, noise } };
}

/** Write a Tracking back out in Metrica wide format (normalised coordinates) - used to test the parser round-trip. */
export function toMetricaCsv(t: Tracking): string {
  const head1 = ["", "", ""].concat(t.players.flatMap(() => ["Home", ""])).join(",");
  const head2 = ["", "", ""].concat(t.players.flatMap((p) => [p.id, ""])).join(",");
  const head3 = ["Period", "Frame", "Time [s]"].concat(t.players.flatMap((p) => [p.id, ""])).join(",");
  const rows: string[] = [head1, head2, head3];
  for (let k = 0; k < t.times.length; k++) {
    const cells: string[] = ["1", String(k + 1), t.times[k].toFixed(2)];
    for (const p of t.players) {
      cells.push(Number.isNaN(p.x[k]) ? "NaN" : (p.x[k] / t.pitch.W).toFixed(5), Number.isNaN(p.y[k]) ? "NaN" : (p.y[k] / t.pitch.H).toFixed(5));
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}
