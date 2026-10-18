import { useEffect, useMemo, useState } from "react";
import { Btn, Card, PageTitle, Tag } from "@/components/ui";
import { Link } from "@/lib/router";
import { FIVE, IDEAS } from "@/content/study-guide";
import type { Idea } from "@/content/study-guide";
import { useCoachContext } from "@/components/Coach";

const KEY = "ie_guide_done";
const readDone = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(t);
    return ok;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="text-sm leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

function IdeaView({ idea, done, onDone }: { idea: Idea; done: boolean; onDone: () => void }) {
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState("");
  useEffect(() => {
    setReveal({});
    setCopied("");
  }, [idea.id]);
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">{idea.n}</span>
          {idea.rung && <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">Your Five · {FIVE[idea.rung - 1].name}</span>}
          <span className="text-xs text-slate-500">textbook name: {idea.ie}</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{idea.name}</h2>
        <p className="mt-1 rounded-md bg-indigo-50 p-2 text-sm text-indigo-950">{idea.oneLine}</p>
      </div>

      <Section title="1 · A soccer scene">{idea.soccerStory}</Section>
      <Section title="2 · Look at it on screen">
        {idea.lookAt}{" "}
        <Link href={idea.route} className="font-medium text-indigo-700 underline">
          Open the page →
        </Link>
        <div className="mt-1 text-xs text-slate-600">
          <b>Try it:</b> {idea.tryIt}
        </div>
      </Section>
      <Section title="3 · The same idea on a factory floor">{idea.factoryTwin}</Section>

      <Card title="4 · One formula you can derive by hand">
        <p className="rounded bg-slate-100 p-2 font-mono text-[13px] text-slate-900">{idea.formulaPlain}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {idea.derive.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      </Card>

      <Card title="5 · A soccer-only worked example (check the arithmetic yourself)">
        <p className="whitespace-pre-wrap text-sm text-slate-800">{idea.soccerPath}</p>
      </Card>

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">6 · The deeper maths (calculus / physics level)</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{idea.deeperMath}</p>
      </details>

      <Section title="7 · What it does NOT tell you">{idea.watchOut}</Section>

      <Card title="8 · Check yourself">
        <ol className="space-y-2 text-sm">
          {idea.selfCheck.map((s, i) => (
            <li key={i}>
              <div className="font-medium text-slate-800">
                {i + 1}. {s.q}
              </div>
              {reveal[i] ? (
                <p className="mt-1 rounded bg-emerald-50 p-2 text-emerald-900">{s.a}</p>
              ) : (
                <button className="mt-1 text-xs text-indigo-700 underline" onClick={() => setReveal((r) => ({ ...r, [i]: true }))}>
                  Show the answer
                </button>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <Card title="9 · Prompts for an AI tutor (copy, paste into any chat)">
        <p className="mb-2 text-xs text-slate-600">
          Each prompt tells the AI not to invent data. Use it to <b>practise explaining</b>, not to produce text you submit: you should be able to re-derive and explain everything above yourself.
        </p>
        <div className="space-y-2">
          {idea.prompts.map((p) => (
            <div key={p.label} className="rounded border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                <Btn kind="ghost" className="!px-2 !py-0.5 !text-xs" onClick={async () => setCopied((await copy(p.text)) ? p.label : "failed")}>
                  {copied === p.label ? "Copied ✓" : "Copy"}
                </Btn>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-slate-500">Show prompt</summary>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{p.text}</p>
              </details>
            </div>
          ))}
          {copied === "failed" && <p className="text-xs text-rose-700">Could not copy automatically. Open “Show prompt” and copy by hand.</p>}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Btn kind={done ? "ghost" : "primary"} onClick={onDone}>
          {done ? "✓ I can explain this (click to undo)" : "I can explain this without looking"}
        </Btn>
        <span className="text-xs text-slate-500">Be honest: tick it only when you can explain it without notes.</span>
      </div>
    </div>
  );
}

export default function GuidePage() {
  const [sel, setSel] = useState(IDEAS[0].id);
  const [done, setDone] = useState<string[]>(readDone);
  const idea = IDEAS.find((i) => i.id === sel) ?? IDEAS[0];
  const toggle = (id: string) =>
    setDone((d) => {
      const n = d.includes(id) ? d.filter((x) => x !== id) : [...d, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(n));
      } catch {
        /* progress is a convenience */
      }
      return n;
    });
  const byRung = useMemo(() => FIVE.map((f) => ({ ...f, ideas: f.ideaIds.map((id) => IDEAS.find((i) => i.id === id)!).filter(Boolean) })), []);
  const extra = IDEAS.filter((i) => !i.rung);

  useCoachContext(`Study Guide: ${idea.name}`, `${idea.oneLine} Soccer scene: ${idea.soccerStory} Formula: ${idea.formulaPlain} Textbook name: ${idea.ie}. Limit: ${idea.watchOut}`);

  const btn = (i: Idea) => (
    <button key={i.id} onClick={() => setSel(i.id)} className={`mb-0.5 flex w-full items-start gap-2 rounded border border-slate-200 px-2 py-1.5 text-left text-[13px] ${sel === i.id ? "bg-indigo-600 text-white" : "bg-white text-slate-800 hover:bg-slate-50"}`}>
      <span className="font-mono text-xs opacity-70">{i.n}</span>
      <span className="flex-1">{i.name}</span>
      {done.includes(i.id) && <span aria-label="ticked">✓</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageTitle
        title="Study Guide: 14 ideas, one soccer scene each"
        sub={
          <>
            Read an idea, do the click it suggests, derive the formula, then explain it in your own words. The first five are <b>Your Five</b> (the ones to own). The other nine are the proof: how you test an idea, stress it, optimise it and measure it. {done.length} of {IDEAS.length} ticked.
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-4">
        <nav aria-label="Ideas" className="space-y-3 lg:col-span-1">
          <div className="lg:hidden">
            <select className="w-full rounded border border-slate-300 p-2 text-sm" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Choose an idea">
              {IDEAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.n}. {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden space-y-3 lg:block">
            {byRung.map((g) => (
              <div key={g.n}>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {g.n} · {g.name}
                </div>
                {g.ideas.map(btn)}
              </div>
            ))}
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Proof and power tools</div>
              {extra.map(btn)}
            </div>
          </div>
        </nav>
        <div className="lg:col-span-3">
          <Card>
            <IdeaView idea={idea} done={done.includes(idea.id)} onDone={() => toggle(idea.id)} />
          </Card>
          <p className="mt-2 text-[11px] text-slate-500">
            <Tag kind="ASSUMED" /> Worked examples use practice numbers you can check by hand; they are not results from the app. Always run the page yourself and quote what you see.
          </p>
        </div>
      </div>
    </div>
  );
}
