import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { answerChallenge, fetchChallenge, gateHoursLeft } from "@/lib/gate";
import type { Challenge } from "@/lib/gate";
import { Btn } from "./ui";

/** Pages publish what is on screen (topic + a plain-text summary of the numbers). The Coach explains ONLY that text. */
interface CoachCtx {
  topic: string;
  context: string;
  open: boolean;
  setOpen: (o: boolean) => void;
  set: (topic: string, context: string) => void;
}
const Ctx = createContext<CoachCtx | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState({ topic: "This page", context: "" });
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ ...s, open, setOpen, set: (topic: string, context: string) => setS((p) => (p.topic === topic && p.context === context ? p : { topic, context })) }), [s, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Call from a page: useCoachContext("Coverage", `coverage is ${...}`) */
export function useCoachContext(topic: string, context: string) {
  const c = useContext(Ctx);
  const set = c?.set;
  useEffect(() => {
    set?.(topic, context);
  }, [set, topic, context]);
}

interface Answer {
  text: string;
  source: string;
  model?: string | null;
  disclaimer: string;
  note?: string;
  limited?: boolean;
}

/** Minimal rendering of the answer: **bold** and paragraphs only. The text comes from a model, so it is never injected as HTML. */
function Plain({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm text-slate-800">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => (seg.startsWith("**") && seg.endsWith("**") ? <b key={j}>{seg.slice(2, -2)}</b> : <span key={j}>{seg}</span>))}
        </p>
      ))}
    </div>
  );
}

export function useCoach() {
  return useContext(Ctx)!;
}

/** A result card can hand its own numbers to the Coach and open it. */
export function ExplainPanel({ topic, context }: { topic: string; context: string }) {
  const c = useCoach();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs">
      <span className="font-semibold text-slate-700">Not sure what this result means?</span>
      <Btn kind="ghost" onClick={() => { c.set(topic, context); c.setOpen(true); }}>Ask the Coach</Btn>
      <span className="text-slate-500">The Coach only sees the numbers shown above.</span>
    </div>
  );
}

export function CoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useContext(Ctx)!;
  const [q, setQ] = useState("");
  const [audience, setAudience] = useState<"highschool" | "technical" | "interview">("highschool");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Answer | null>(null);
  const [err, setErr] = useState("");
  const [gate, setGate] = useState<Challenge | null>(null);
  const [sum, setSum] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [gateMsg, setGateMsg] = useState("");
  const [hoursLeft, setHoursLeft] = useState(() => gateHoursLeft());
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setAns(null);
    setErr("");
  }, [c.topic]);
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);
  if (!open) return null;
  const openGate = async () => {
    try {
      const ch = await fetchChallenge();
      if (!ch.required) {
        setGate(null);
        return;
      }
      setGate(ch);
      setSum("");
      setGateMsg("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const unlock = async () => {
    if (!gate) return;
    setUnlocking(true);
    setGateMsg("");
    try {
      const h = await answerChallenge(gate, sum);
      setHoursLeft(h);
      setGate(null);
      setSum("");
      setGateMsg(`Unlocked for ${h} hours in this browser.`);
      await ask();
    } catch (e) {
      setGateMsg((e as Error).message);
    }
    setUnlocking(false);
  };
  const ask = async () => {
    setBusy(true);
    setErr("");
    try {
      setAns(await api<Answer>("ai/explain", { body: { topic: c.topic, context: c.context || "(no numbers on this page yet)", audience, question: q } }));
      setGate(null);
      setHoursLeft(gateHoursLeft());
    } catch (e) {
      if (e instanceof ApiError && e.code === "gate_required") await openGate();
      else setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div ref={boxRef} tabIndex={-1} role="dialog" aria-label="Coach" className="fixed bottom-16 right-4 z-40 flex max-h-[75vh] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-xl border border-slate-300 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div>
          <div className="text-sm font-bold text-slate-900">
            Coach <span className="font-normal text-slate-500">· {c.topic}</span>
          </div>
          <div className="text-[11px] text-slate-500">Explains the numbers on this page. It never computes results.</div>
        </div>
        <button onClick={onClose} aria-label="Close coach" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">
          ✕
        </button>
      </div>
      <div className="space-y-2 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1 text-xs">
          {(
            [
              ["highschool", "Plain"],
              ["technical", "With the math"],
              ["interview", "Spoken"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setAudience(k)} className={`rounded-full border px-2 py-0.5 ${audience === k ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {l}
            </button>
          ))}
        </div>
        <textarea value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))} rows={2} placeholder="Optional: ask one question about what you see…" className="w-full rounded border border-slate-300 p-2 text-sm" />
        <div className="flex items-center gap-2">
          <Btn onClick={ask} disabled={busy}>
            {busy ? "Thinking…" : q.trim() ? "Ask" : "Explain this page"}
          </Btn>
          <span className="text-[11px] text-slate-500">{q.length}/300</span>
        </div>
        {gate && (
          <div className="rounded border border-indigo-300 bg-indigo-50 p-2 text-xs text-indigo-950">
            <div className="font-semibold">Live AI is locked in this browser</div>
            <p className="mt-0.5 text-[11px]">Answer one sum to use the live Coach. This is not a login: it keeps bots off the paid AI, and it lasts 24 hours on this browser.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-base">{gate.a} + {gate.b} =</span>
              <input
                value={sum}
                inputMode="numeric"
                onChange={(e) => setSum(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlock();
                }}
                aria-label={`What is ${gate.a} plus ${gate.b}`}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <Btn onClick={unlock} disabled={unlocking || sum.trim() === ""}>
                {unlocking ? "Checking…" : "Unlock"}
              </Btn>
            </div>
            {gateMsg && <div className="mt-1 text-[11px] text-rose-700">{gateMsg}</div>}
          </div>
        )}
        {!gate && hoursLeft > 0 && <div className="text-[11px] text-emerald-700">Live AI unlocked · about {hoursLeft} h left in this browser.</div>}
        {err && <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{err}</div>}
        {ans && (
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
            <Plain text={ans.text} />
            <div className="border-t border-slate-200 pt-1 text-[11px] text-slate-500">
              {ans.source === "deepseek" ? `AI-written (DeepSeek ${ans.model ?? ""}).` : "Offline template (no AI used)."} {ans.note ? ans.note + " " : ""}
              {ans.disclaimer}
            </div>
          </div>
        )}
        <details className="text-[11px] text-slate-500">
          <summary className="cursor-pointer">What the Coach can see</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2">{c.context || "(nothing yet)"}</pre>
        </details>
      </div>
    </div>
  );
}
