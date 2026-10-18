import { useMemo, useState } from "react";
import { marked } from "marked";
import { Card, PageTitle } from "@/components/ui";
import d1 from "../../docs/01-start-here.md?raw";
import d2 from "../../docs/02-soccer-to-factory.md?raw";
import d3 from "../../docs/03-factory-field-guide.md?raw";
import d4 from "../../docs/04-present-it.md?raw";
import d5 from "../../docs/05-faq-troubleshooting.md?raw";
import d6 from "../../docs/06-glossary.md?raw";

// Our own repository markdown, rendered without raw HTML.
marked.use({ renderer: { html: () => "" } });

const DOCS = [
  { id: "start", label: "10-minute first session", src: d1 },
  { id: "dict", label: "Soccer ↔ factory dictionary", src: d2 },
  { id: "field", label: "On a real factory floor", src: d3 },
  { id: "present", label: "Present it", src: d4 },
  { id: "faq", label: "FAQ & troubleshooting", src: d5 },
  { id: "glossary", label: "Glossary", src: d6 },
] as const;

export default function HelpPage() {
  const [tab, setTab] = useState<(typeof DOCS)[number]["id"]>("start");
  const doc = DOCS.find((d) => d.id === tab)!;
  const html = useMemo(() => marked.parse(doc.src, { async: false }) as string, [doc]);
  return (
    <div className="space-y-4">
      <PageTitle title="Help" sub="How to use the lab, how soccer maps to a factory, how to explain it, and what to do when something does not work." />
      <div className="flex flex-wrap items-center gap-1 print:hidden" role="tablist" aria-label="Help documents">
        {DOCS.map((d) => (
          <button key={d.id} role="tab" aria-selected={tab === d.id} onClick={() => setTab(d.id)} className={`rounded-md px-3 py-1.5 text-sm ${tab === d.id ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {d.label}
          </button>
        ))}
        <button onClick={() => window.print()} className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          Print / save as PDF
        </button>
      </div>
      <Card>
        <article className="md max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
      </Card>
    </div>
  );
}
