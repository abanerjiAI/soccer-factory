import type { ReactNode } from "react";

const PAD = { l: 44, r: 12, t: 10, b: 30 };
const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d"];
const nice = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

export function LineChart({ x, series, xLabel, yLabel, windows, yMin, yMax, height = 220 }: { x: number[]; series: { name: string; y: number[]; color?: string; dashed?: boolean }[]; xLabel?: string; yLabel?: string; windows?: { from: number; to: number; label?: string }[]; yMin?: number; yMax?: number; height?: number }) {
  const W = 640, H = height;
  const all = series.flatMap((s) => s.y).filter(Number.isFinite);
  const lo = yMin ?? Math.min(0, ...all), hi = yMax ?? Math.max(1e-9, ...all) * 1.05;
  const x0 = Math.min(...x), x1 = Math.max(...x);
  const sx = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - ((v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {windows?.map((w, i) => (
          <g key={i}>
            <rect x={sx(w.from)} y={PAD.t} width={Math.max(2, sx(w.to) - sx(w.from))} height={H - PAD.t - PAD.b} fill="rgba(244,63,94,0.12)" />
            {w.label && <text x={sx(w.from) + 3} y={PAD.t + 10} fontSize="9" fill="#be123c">{w.label}</text>}
          </g>
        ))}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" />
            <text x={PAD.l - 4} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#64748b">{nice(t)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={sx(x0 + f * (x1 - x0))} y={H - PAD.b + 12} textAnchor="middle" fontSize="9" fill="#64748b">{(x0 + f * (x1 - x0)).toFixed(0)}</text>
        ))}
        {series.map((s, k) => (
          <polyline key={s.name} fill="none" strokeWidth="2" stroke={s.color ?? COLORS[k % COLORS.length]} strokeDasharray={s.dashed ? "5 4" : undefined} points={s.y.map((v, i) => `${sx(x[i])},${sy(v)}`).join(" ")} />
        ))}
        {xLabel && <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#475569">{xLabel}</text>}
        {yLabel && <text x={10} y={H / 2} fontSize="10" fill="#475569" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">{yLabel}</text>}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {series.map((s, k) => (
          <span key={s.name} className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color ?? COLORS[k % COLORS.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bars({ items, unit, max }: { items: { label: ReactNode; value: number; lo?: number; hi?: number; color?: string }[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.hi ?? 0)));
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="text-xs">
          <div className="flex justify-between text-slate-600">
            <span>{it.label}</span>
            <span className="font-mono text-slate-900">
              {nice(it.value)}
              {unit}
              {it.lo !== undefined && Number.isFinite(it.lo) && <span className="text-slate-500"> [{nice(it.lo)}, {nice(it.hi ?? it.value)}]</span>}
            </span>
          </div>
          <div className="relative h-3 rounded bg-slate-100">
            <div className="absolute h-3 rounded" style={{ width: `${Math.max(0, (it.value / m) * 100)}%`, background: it.color ?? "#6366f1" }} />
            {it.lo !== undefined && Number.isFinite(it.lo) && it.hi !== undefined && <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-900" style={{ left: `${Math.max(0, (it.lo / m) * 100)}%`, width: `${Math.max(0, ((it.hi - it.lo) / m) * 100)}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Scatter({ points, xLabel, yLabel, height = 260 }: { points: { x: number; y: number; label: string; highlight?: boolean; color?: string }[]; xLabel: string; yLabel: string; height?: number }) {
  const W = 640, H = height;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const px = (Math.max(...xs) - Math.min(...xs)) * 0.08 || 0.01, py = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 0.01;
  const x0 = Math.min(...xs) - px, x1 = Math.max(...xs) + px, y0 = Math.min(...ys) - py, y1 = Math.max(...ys) + py;
  const sx = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - ((v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(y0 + f * (y1 - y0))} y2={sy(y0 + f * (y1 - y0))} stroke="#e2e8f0" />
          <text x={PAD.l - 4} y={sy(y0 + f * (y1 - y0)) + 3} fontSize="9" textAnchor="end" fill="#64748b">{nice(y0 + f * (y1 - y0))}</text>
          <text x={sx(x0 + f * (x1 - x0))} y={H - PAD.b + 12} fontSize="9" textAnchor="middle" fill="#64748b">{nice(x0 + f * (x1 - x0))}</text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.highlight ? 6 : 4} fill={p.color ?? (p.highlight ? "#059669" : "#94a3b8")} stroke="#fff" strokeWidth="1">
            <title>{p.label}</title>
          </circle>
          {p.highlight && <text x={sx(p.x) + 8} y={sy(p.y) + 3} fontSize="8" fill="#065f46">{p.label.slice(0, 22)}</text>}
        </g>
      ))}
      <text x={W / 2} y={H - 3} fontSize="10" textAnchor="middle" fill="#475569">{xLabel}</text>
      <text x={10} y={H / 2} fontSize="10" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle" fill="#475569">{yLabel}</text>
    </svg>
  );
}

export function Histogram({ bins, xLabel }: { bins: { lo: number; hi: number; count: number }[]; xLabel: string }) {
  const m = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5">
        {bins.map((b, i) => (
          <div key={i} className="flex-1 rounded-t bg-indigo-400" style={{ height: `${(b.count / m) * 100}%` }} title={`${nice(b.lo)}–${nice(b.hi)}: ${b.count}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{bins.length ? nice(bins[0].lo) : ""}</span>
        <span>{xLabel}</span>
        <span>{bins.length ? nice(bins[bins.length - 1].hi) : ""}</span>
      </div>
    </div>
  );
}
