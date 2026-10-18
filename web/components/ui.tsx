import { useCallback, useState } from "react";
import type { ReactNode } from "react";

export type EvidenceKind = "MEASURED" | "OBSERVED" | "CALCULATED" | "SIMULATED" | "ESTIMATED" | "ASSUMED" | "HYPOTHESIZED" | "EXTERNAL FACT" | "FUTURE WORK";
const TAG_STYLE: Record<EvidenceKind, string> = {
  MEASURED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  OBSERVED: "bg-teal-100 text-teal-800 border-teal-300",
  CALCULATED: "bg-sky-100 text-sky-800 border-sky-300",
  SIMULATED: "bg-indigo-100 text-indigo-800 border-indigo-300",
  ESTIMATED: "bg-violet-100 text-violet-800 border-violet-300",
  ASSUMED: "bg-amber-100 text-amber-800 border-amber-300",
  HYPOTHESIZED: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  "EXTERNAL FACT": "bg-slate-200 text-slate-800 border-slate-400",
  "FUTURE WORK": "bg-stone-100 text-stone-600 border-stone-300",
};
export function Tag({ kind, title }: { kind: EvidenceKind; title?: string }) {
  return (
    <span title={title ?? `Evidence class: ${kind}`} className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG_STYLE[kind]}`}>
      {kind}
    </span>
  );
}

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, sub, tags }: { title: string; sub: ReactNode; tags?: EvidenceKind[] }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 max-w-4xl text-sm text-slate-600">{sub}</p>
      {tags && <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <Tag key={t} kind={t} />)}</div>}
    </div>
  );
}

export function Btn({ children, onClick, disabled, kind = "primary", className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost" | "danger"; className?: string }) {
  const k = kind === "primary" ? "bg-indigo-600 text-white hover:bg-indigo-700" : kind === "danger" ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${k} ${className}`}>
      {children}
    </button>
  );
}

export function Slider({ label, value, min, max, step, onChange, unit, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; hint?: string }) {
  return (
    <label className="block text-xs text-slate-600" title={hint}>
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-slate-900">
          {Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input type="range" className="w-full accent-indigo-600" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-lg font-semibold ${c}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Table({ headers, rows, dense }: { headers: string[]; rows: (string | number | ReactNode)[][]; dense?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left ${dense ? "text-xs" : "text-sm"}`}>
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ kind = "info", title, children }: { kind?: "info" | "warn" | "bad" | "good"; title?: string; children: ReactNode }) {
  const s = { info: "border-sky-200 bg-sky-50 text-sky-900", warn: "border-amber-300 bg-amber-50 text-amber-900", bad: "border-rose-300 bg-rose-50 text-rose-900", good: "border-emerald-300 bg-emerald-50 text-emerald-900" }[kind];
  return (
    <div className={`rounded-lg border p-3 text-sm ${s}`}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="text-xs text-slate-600">
      <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
        <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1">{label ?? "running"} — {pct}%</div>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  const c = verdict === "SUPPORTED" ? "bg-emerald-600" : verdict === "NOT SUPPORTED" ? "bg-rose-600" : "bg-amber-500";
  return <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${c}`}>{verdict}</span>;
}

/** Hook for explicit "Run" actions with progress (expensive computations are never pretended to be instant). */
export function useRunner<T>() {
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 1, label: "" });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const run = useCallback(async (fn: (p: (d: number, t: number, l?: string) => void) => Promise<T>) => {
    setRunning(true);
    setError(null);
    setProg({ done: 0, total: 1, label: "starting" });
    try {
      const r = await fn((d, t, l) => setProg({ done: d, total: t, label: l ?? "" }));
      setResult(r);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setRunning(false);
    }
  }, []);
  return { running, prog, error, result, run, setResult };
}

export { saveExperiment } from "@/lib/api";

export function SaveButton({ onSave }: { onSave: () => Promise<string> }) {
  const [state, setState] = useState<string>("");
  return (
    <span className="inline-flex items-center gap-2">
      <Btn kind="ghost" onClick={async () => { setState("saving…"); try { setState(`recorded as ${await onSave()}`); } catch (e) { setState(`failed: ${(e as Error).message}`); } }}>
        Record experiment
      </Btn>
      {state && <span className="text-xs text-slate-600">{state}</span>}
    </span>
  );
}
