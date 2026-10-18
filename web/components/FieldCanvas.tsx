import { useEffect, useRef } from "react";
import type { Environment, Frame, Vec } from "@/engine/types";

export type Overlay = "none" | "coverage" | "demand" | "dead" | "bottleneck" | "access" | "persistent";
export const OVERLAYS: { id: Overlay; label: string; help: string }[] = [
  { id: "none", label: "None", help: "" },
  { id: "coverage", label: "Coverage", help: "cov_c = 1 - prod(1 - p_ic): chance some agent can reach the cell within the response budget (red = low, green = high)." },
  { id: "demand", label: "Demand", help: "D_c: spatial demand (units/s) from focus, opponents/stations and base level." },
  { id: "dead", label: "Dead cells (now)", help: "Cells with demand above half the average and coverage below the dead threshold at this instant (TEMPORARY if short-lived)." },
  { id: "persistent", label: "Persistent vs temporary dead zones", help: "Over the whole run: red = dead >= 50% of the time AND continuously for >= persistence time; yellow = dead at some time but not persistent." },
  { id: "bottleneck", label: "Bottleneck (capacity-limited loss)", help: "Demand lost because the responsible agents are over capacity (L_i > mu_i). Zero when capacity suffices." },
  { id: "access", label: "Access-limited loss", help: "D_c x (1 - cov_c): demand that no agent can reach in time." },
];

interface Props {
  env: Environment;
  frame?: Frame | null;
  overlay?: Overlay;
  nx: number;
  ny: number;
  trails?: Frame[];
  groups?: { pts: Vec[]; color: string; label?: string }[];
  pins?: { u: number; v: number; label: string; color: string }[];
  onPick?: (u: number, v: number) => void;
  deadMaps?: { persistent: Uint8Array; temporary: Uint8Array } | null;
  className?: string;
}

const CW = 900;

export default function FieldCanvas({ env, frame, overlay = "none", nx, ny, trails, groups, pins, onPick, deadMaps, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const CH = Math.round((CW * env.height) / env.width);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const s = CW / env.width;
    const X = (x: number) => x * s, Y = (y: number) => y * s;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = env.mode === "soccer" ? "#2f7d46" : "#d9dde3";
    ctx.fillRect(0, 0, CW, CH);

    if (env.mode === "soccer") {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      const W = env.width, H = env.height;
      ctx.strokeRect(X(0) + 1, Y(0) + 1, X(W) - 2, Y(H) - 2);
      ctx.beginPath();
      ctx.moveTo(X(W / 2), 0);
      ctx.lineTo(X(W / 2), Y(H));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X(W / 2), Y(H / 2), 9.15 * s, 0, 7);
      ctx.stroke();
      for (const side of [0, 1]) {
        const x0 = side ? W - 16.5 : 0, x1 = side ? W - 5.5 : 0;
        ctx.strokeRect(X(x0), Y((H - 40.3) / 2), 16.5 * s, 40.3 * s);
        ctx.strokeRect(X(x1), Y((H - 18.3) / 2), 5.5 * s, 18.3 * s);
      }
    }

    const cw = CW / nx, ch = CH / ny;
    const heat = (fn: (c: number) => string | null) => {
      for (let c = 0; c < nx * ny; c++) {
        const col = fn(c);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect((c % nx) * cw, Math.floor(c / nx) * ch, cw + 0.5, ch + 0.5);
      }
    };
    if (overlay === "persistent" && deadMaps) heat((c) => (deadMaps.persistent[c] ? "rgba(220,38,38,0.65)" : deadMaps.temporary[c] ? "rgba(250,204,21,0.55)" : null));
    else if (frame && overlay !== "none") {
      if (overlay === "coverage" && frame.cov) heat((c) => `hsla(${120 * frame.cov![c]},75%,45%,0.5)`);
      if (overlay === "demand" && frame.demand) {
        const mx = Math.max(...frame.demand, 1e-9);
        heat((c) => `rgba(249,115,22,${Math.min(0.85, (frame.demand![c] / mx) * 0.85)})`);
      }
      if (overlay === "dead" && frame.dead) heat((c) => (frame.dead![c] ? "rgba(220,38,38,0.6)" : null));
      if (overlay === "bottleneck" && frame.bott) {
        const mx = Math.max(...frame.bott, 1e-9);
        heat((c) => (frame.bott![c] > 1e-9 ? `rgba(217,70,239,${0.2 + 0.7 * (frame.bott![c] / mx)})` : null));
      }
      if (overlay === "access" && frame.access) {
        const mx = Math.max(...frame.access, 1e-9);
        heat((c) => `rgba(234,88,12,${Math.min(0.85, (frame.access![c] / mx) * 0.85)})`);
      }
    }

    // restricted areas & stations (facility)
    for (const r of env.staticBlocked) {
      ctx.fillStyle = "rgba(51,65,85,0.88)";
      ctx.fillRect(X(r.x), Y(r.y), r.w * s, r.h * s);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "11px sans-serif";
      ctx.fillText("restricted", X(r.x) + 4, Y(r.y) + 14);
    }
    if (env.flowRoute.length) {
      ctx.strokeStyle = "rgba(30,41,59,0.55)";
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      env.flowRoute.forEach((id, i) => {
        const st = env.fixedSources.find((q) => q.id === id);
        if (!st) return;
        if (i === 0) ctx.moveTo(X(st.x), Y(st.y));
        else ctx.lineTo(X(st.x), Y(st.y));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (env.mode === "facility")
      env.fixedSources.forEach((st) => {
        ctx.fillStyle = st.critical ? "#b45309" : "#f59e0b";
        ctx.fillRect(X(st.x) - 9, Y(st.y) - 9, 18, 18);
        ctx.fillStyle = "#111827";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(st.id, X(st.x) - 8, Y(st.y) + 4);
      });

    // blocked disturbance regions
    for (const b of frame?.blocked ?? []) {
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      ctx.strokeStyle = "#0f172a";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(X(b.x), Y(b.y), b.r * s, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("INACCESSIBLE", X(b.x) - 38, Y(b.y) + 4);
    }

    // trails
    if (trails && trails.length > 1) {
      const n = trails[0].A.length / 2;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = "rgba(191,219,254,0.6)";
        ctx.beginPath();
        trails.forEach((f, k) => (k === 0 ? ctx.moveTo(X(f.A[2 * i]), Y(f.A[2 * i + 1])) : ctx.lineTo(X(f.A[2 * i]), Y(f.A[2 * i + 1]))));
        ctx.stroke();
      }
    }

    const dot = (x: number, y: number, r: number, fill: string, stroke = "#fff") => {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r, 0, 7);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    if (frame) {
      for (let j = 0; j < frame.B.length / 2; j++) dot(frame.B[2 * j], frame.B[2 * j + 1], 7, "#dc2626");
      for (let i = 0; i < frame.A.length / 2; i++) {
        const ok = frame.avail[i];
        dot(frame.A[2 * i], frame.A[2 * i + 1], 9, ok ? "#2563eb" : "#6b7280");
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(ok ? String(i) : "×", X(frame.A[2 * i]) - (ok ? 3 : 3.5), Y(frame.A[2 * i + 1]) + 3.5);
      }
      dot(frame.focus[0], frame.focus[1], 6, "#facc15", "#111827");
    }
    groups?.forEach((g) => {
      g.pts.forEach((p, i) => {
        dot(p.x, p.y, 8, g.color);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText(String(i), X(p.x) - 3, Y(p.y) + 3);
      });
    });
    pins?.forEach((p) => {
      const x = p.u * env.width, y = p.v * env.height;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 12, 0, 7);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(p.label, X(x) + 14, Y(y) + 4);
    });
  }, [env, frame, overlay, nx, ny, trails, groups, pins, deadMaps, CH]);

  return (
    <canvas
      ref={ref}
      width={CW}
      height={CH}
      className={`w-full rounded-lg border border-slate-300 ${onPick ? "cursor-crosshair" : ""} ${className ?? ""}`}
      onClick={(e) => {
        if (!onPick) return;
        const r = e.currentTarget.getBoundingClientRect();
        onPick(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      }}
    />
  );
}
