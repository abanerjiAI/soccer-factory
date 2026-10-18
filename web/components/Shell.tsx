import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LAYOUTS } from "@/engine/environments";
import { LabProvider, useLab } from "./LabContext";
import { Link, usePath } from "@/lib/router";
import { NAV, titleOf } from "@/nav";
import { markVisited, useVisited } from "@/lib/progress";
import { CoachPanel, CoachProvider, useCoach } from "./Coach";

function LabBar({ path }: { path: string }) {
  const lab = useLab();
  const showSeed = path === "/lab" || path === "/whatif";
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Same engine</span>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Environment">
          {(["soccer", "facility"] as const).map((m) => (
            <button key={m} onClick={() => lab.setMode(m)} aria-pressed={lab.mode === m} title={m === "soccer" ? "The same engine on a 105 x 68 m pitch" : "The same engine on a 60 x 40 m factory floor"} className={`px-3.5 py-1.5 text-[13px] font-semibold ${lab.mode === m ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {m === "soccer" ? "⚽ Soccer" : "🏭 Factory"}
            </button>
          ))}
        </div>
        {lab.mode === "facility" && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Layout
            <select className="rounded border border-slate-300 px-1 py-1" value={lab.layoutId} onChange={(e) => lab.setLayoutId(e.target.value)}>
              {LAYOUTS.facility.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {path !== "/" && path !== "/layouts" && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            {lab.mode === "soccer" ? "Formation" : `${lab.env.vocab.agent} arrangement`}
            <select className="rounded border border-slate-300 px-1 py-1" value={lab.formationId} onChange={(e) => lab.setFormationId(e.target.value)}>
              {lab.formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {showSeed && (
          <label className="flex items-center gap-1 text-xs text-slate-600" title="Same seed = same random events, so two runs can be compared fairly.">
            Seed
            <input type="number" className="w-20 rounded border border-slate-300 px-1 py-1" value={lab.seed} onChange={(e) => lab.setSeed(Math.trunc(Number(e.target.value)) || 0)} />
          </label>
        )}
        <span className="ml-auto hidden text-[11px] text-slate-500 lg:inline">
          Numbers are <b>SIMULATED</b> with <b>ASSUMED</b> settings unless tagged otherwise.
        </span>
      </div>
    </div>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const visited = useVisited();
  const [openAdv, setOpenAdv] = useState(false);
  const inAdvanced = NAV.find((g) => g.collapsed)?.items.some((i) => i.href === path);
  return (
    <nav aria-label="Main" className="space-y-4">
      {NAV.map((g) => {
        const open = !g.collapsed || openAdv || inAdvanced;
        return (
          <div key={g.title}>
            {g.collapsed ? (
              <button onClick={() => setOpenAdv((o) => !o)} aria-expanded={open} className="mb-1 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                {g.title} <span>{open ? "▾" : "▸"}</span>
              </button>
            ) : (
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</div>
            )}
            {open && (
              <div className="space-y-0.5">
                {g.items.map((n) => (
                  <Link key={n.href} href={n.href} onClick={onNavigate} title={n.hint} className={`flex items-center gap-2 rounded px-2 py-1.5 text-[13px] ${path === n.href ? "bg-indigo-600 text-white" : "hover:bg-slate-800"}`}>
                    {n.step ? <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${path === n.href ? "bg-white text-indigo-700" : "bg-slate-700 text-slate-200"}`}>{n.step}</span> : <span className="w-5" />}
                    <span className="flex-1">{n.label}</span>
                    {visited.has(n.href) && path !== n.href && <span aria-label="visited" className="text-emerald-400">✓</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePath();
  const coach = useCoach();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    markVisited(path);
    document.title = `${titleOf(path)} · Soccer Factory`;
    setMenu(false);
  }, [path]);
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-slate-900 p-3 text-slate-200 md:block print:hidden">
        <Link href="/" className="mb-4 block px-2">
          <div className="text-base font-bold leading-tight text-white">⚽ Soccer Factory</div>
          <div className="mt-0.5 text-[11px] leading-snug text-slate-400">Soccer as Industrial Engineering · one engine, a pitch and a factory floor</div>
        </Link>
        <Sidebar path={path} />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-3 py-2 text-slate-100 md:hidden print:hidden">
          <span className="text-sm font-bold">⚽ Soccer Factory</span>
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="rounded border border-slate-600 px-2 py-1 text-xs">
            Menu {menu ? "▴" : "▾"}
          </button>
        </div>
        {menu && (
          <div className="bg-slate-900 p-3 text-slate-200 md:hidden">
            <Sidebar path={path} onNavigate={() => setMenu(false)} />
          </div>
        )}
        <LabBar path={path} />
        <main className="mx-auto max-w-6xl p-4" id="main">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-20 pt-2 text-[11px] text-slate-500 print:hidden">
          A teaching model, not a measurement of any real team or factory. Parameters are assumptions; the soccer-to-factory link is shared mathematics, not an identity. <Link href="/buildnotes" className="underline">What is NOT claimed</Link>
        </footer>
      </div>
      <button onClick={() => coach.setOpen(!coach.open)} className="fixed bottom-4 right-4 z-40 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700 print:hidden" aria-expanded={coach.open}>
        💬 Coach
      </button>
      <CoachPanel open={coach.open} onClose={() => coach.setOpen(false)} />
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <LabProvider>
      <CoachProvider>
        <Frame>{children}</Frame>
      </CoachProvider>
    </LabProvider>
  );
}
