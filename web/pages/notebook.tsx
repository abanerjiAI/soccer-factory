import { useEffect, useMemo, useState } from "react";
import { Btn, Callout, Card, PageTitle } from "@/components/ui";
import { Link } from "@/lib/router";
import { emptyNote, loadNotebook, saveNotebook } from "@/lib/progress";
import type { NoteEntry, Notebook } from "@/lib/progress";
import { FIVE } from "@/content/study-guide";

const AI_KEY = "ai";

const PROMPTS: Record<number, { own: string; result: string; page: string }> = {
  1: { own: "In your own words: what is coverage, and why does a bunched-up team cover less?", result: "What did you see? e.g. which arrangement reached the most pitch, with what number?", page: "/" },
  2: { own: "In your own words: why can a team reach 70% of the pitch but still be exposed?", result: "What did you see? e.g. plain vs important coverage with the ball far from your players", page: "/" },
  3: { own: "In your own words: what is the difference between being too far away and being overloaded?", result: "What did you see? e.g. the peak utilisation, whether a bottleneck appeared, and the +20% capacity test", page: "/lab" },
  4: { own: "In your own words: what does the red-card test measure, and why keep depth, duration and recovery separate?", result: "What did you see? e.g. which disturbance hurt most, and how long recovery took", page: "/whatif" },
  5: { own: "In your own words: what carried over to the factory floor, and what did not?", result: "What did you see? e.g. which layout won which measure", page: "/layouts" },
};

function composeScript(nb: Notebook): { text: string; blanks: string[] } {
  const blanks: string[] = [];
  const get = (n: number, f: keyof NoteEntry, label: string) => {
    const v = (nb[String(n)]?.[f] as string | undefined)?.trim();
    if (!v) {
      blanks.push(label);
      return `[${label}]`;
    }
    return v.replace(/\s+/g, " ");
  };
  const firstOf = (f: "surprise" | "limit", label: string) => {
    for (const n of [1, 2, 3, 4, 5]) {
      const v = (nb[String(n)]?.[f] as string | undefined)?.trim();
      if (v) return v.replace(/\s+/g, " ");
    }
    blanks.push(label);
    return `[${label}]`;
  };
  const parts = [
    "I play soccer, and I wanted to know what industrial engineering actually is, so I used the one complex system I already understand as a lab.",
    `First, reach: ${get(1, "ownWords", "reach, in your own words")} What I saw: ${get(1, "result", "reach: your result")}`,
    `Then importance: ${get(2, "ownWords", "importance, in your own words")} What I saw: ${get(2, "result", "importance: your result")}`,
    `Then the constraint: ${get(3, "ownWords", "constraint, in your own words")} What I saw: ${get(3, "result", "constraint: your result")}`,
    `Then the shock, a red card: ${get(4, "ownWords", "shock, in your own words")} What I saw: ${get(4, "result", "shock: your result")}`,
    `Finally I ran the same engine on a factory floor: ${get(5, "ownWords", "transfer, in your own words")} What I saw: ${get(5, "result", "transfer: your result")}`,
    `What surprised me was ${firstOf("surprise", "your surprise")}`,
    `The limit is ${firstOf("limit", "your limit")} The numbers are simulated with assumed settings, so this models a team rather than measuring one.`,
  ];
  return { text: parts.join("\n\n"), blanks };
}

export default function NotebookPage() {
  const [nb, setNb] = useState<Notebook>(loadNotebook);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      saveNotebook(nb);
      setSaved("Saved in this browser");
    }, 400);
    return () => clearTimeout(t);
  }, [nb]);

  const set = (n: string, patch: Partial<NoteEntry>) => setNb((o) => ({ ...o, [n]: { ...(o[n] ?? emptyNote()), ...patch } }));
  const script = useMemo(() => composeScript(nb), [nb]);
  const words = script.text.replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean).length;
  const seconds = Math.round(words / 2.5);
  const doneCount = FIVE.filter((f) => nb[String(f.n)]?.done).length;

  const exportMd = () => {
    const lines = ["# My Notebook: soccer as industrial engineering", ""];
    for (const f of FIVE) {
      const e = nb[String(f.n)] ?? emptyNote();
      lines.push(`## ${f.n}. ${f.name}: ${f.question}`, "", `**In my own words:** ${e.ownWords || "(blank)"}`, "", `**What I saw:** ${e.result || "(blank)"}`, "", `**What surprised me:** ${e.surprise || "(blank)"}`, "", `**The limit:** ${e.limit || "(blank)"}`, "");
    }
    lines.push("## How I used AI", "", nb[AI_KEY]?.ownWords || "(blank)", "", "## My answer", "", script.text, "");
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-notebook.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="My Notebook: your own result, surprise and limit"
        sub={<>The lab can compute numbers, but only you can say what you saw. For each of Your Five, write it in your own words, then fill in what you actually observed. The script at the bottom is built <b>only from what you type</b>: blanks stay blanks, so nothing in it can be invented for you. Everything is stored in this browser only.</>}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>{doneCount} of 5 marked “I can explain this”.</span>
        <span className="text-slate-400">{saved}</span>
        <span className="ml-auto flex gap-2">
          <Btn kind="ghost" onClick={exportMd}>Download as Markdown</Btn>
          <Btn kind="ghost" onClick={() => window.print()}>Print</Btn>
          <Btn kind="danger" onClick={() => { if (window.confirm("Erase everything you wrote in this notebook? This cannot be undone.")) setNb({}); }}>Erase all</Btn>
        </span>
      </div>

      {FIVE.map((f) => {
        const e = nb[String(f.n)] ?? emptyNote();
        const p = PROMPTS[f.n];
        return (
          <Card key={f.n} title={`${f.n} · ${f.name}: ${f.question}`} right={<Link href={p.page} className="text-xs text-indigo-700 underline">open the page →</Link>}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700">
                {p.own}
                <textarea className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal" rows={3} value={e.ownWords} onChange={(ev) => set(String(f.n), { ownWords: ev.target.value })} />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                {p.result}
                <textarea className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal" rows={3} value={e.result} onChange={(ev) => set(String(f.n), { result: ev.target.value })} />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                What surprised you, if anything? (leave blank if nothing did)
                <textarea className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal" rows={2} value={e.surprise} onChange={(ev) => set(String(f.n), { surprise: ev.target.value })} />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                What is the limit? What does this NOT tell you?
                <textarea className="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal" rows={2} value={e.limit} onChange={(ev) => set(String(f.n), { limit: ev.target.value })} />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={e.done} onChange={(ev) => set(String(f.n), { done: ev.target.checked })} /> I can re-derive this and say it out loud without looking.
            </label>
          </Card>
        );
      })}

      <Card title="How I used AI (be specific and honest)">
        <textarea className="w-full rounded border border-slate-300 p-2 text-sm" rows={3} placeholder="e.g. An AI wrote the first version of the code; I ran every page, re-derived the formulas in the Study Guide, and wrote this notebook myself." value={nb[AI_KEY]?.ownWords ?? ""} onChange={(ev) => set(AI_KEY, { ownWords: ev.target.value })} />
        <p className="mt-1 text-xs text-slate-500">If someone asks, a clear answer here is better than a vague one. It is stored only in your browser.</p>
      </Card>

      <Card title={`My answer in your own words (~${seconds} s when spoken)`}>
        {script.blanks.length > 0 && <Callout kind="warn" title={`${script.blanks.length} blank${script.blanks.length > 1 ? "s" : ""} left to fill`}>Fill the boxes above and the square brackets disappear: {script.blanks.map((b) => `[${b}]`).join(" ")}</Callout>}
        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">{script.text}</pre>
        <p className="mt-1 text-xs text-slate-500">Short enough? A 90-second answer is about 225 words. Cut until it is one result, one surprise, one limit.</p>
      </Card>
    </div>
  );
}
