// UI checks without a browser: runs the real app bundle inside jsdom against the real PHP API (http://127.0.0.1:8080/ by default).
// Verifies behaviour (routing, interactions, saving, reproduce, coach, notebook). It does NOT verify visual layout: use a real browser for that.
// usage: node tools/ui-check.mjs [baseUrl]    (needs: npm run package && npm run serve, and `vite build --config vite.config.iife.mjs`)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const code = fs.readFileSync(path.join(root, ".build-ui", "app.js"), "utf8");

const problems = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { if (!/Not implemented: (window\.scrollTo|HTMLCanvasElement)/.test(e.message)) problems.push("jsdomError: " + e.message.split("\n")[0]); });
vc.on("error", (...a) => problems.push("console.error: " + a.map(String).join(" ").slice(0, 220)));
const dom = new JSDOM('<!doctype html><html><body class="bg-slate-100"><div id="root"></div></body></html>', { url: base, pretendToBeVisual: true, runScripts: "outside-only", virtualConsole: vc });
const w = dom.window;
const d = w.document;

// ---- shims for things jsdom lacks
const grad = () => ({ addColorStop() {} });
const ctx = {
  measureText: () => ({ width: 0 }),
  createRadialGradient: grad, createLinearGradient: grad,
  getImageData: (x, y, wd, ht) => ({ width: wd, height: ht, data: new Uint8ClampedArray(Math.max(0, wd) * Math.max(0, ht) * 4) }),
  createImageData: (wd, ht) => ({ width: wd, height: ht, data: new Uint8ClampedArray(Math.max(0, wd) * Math.max(0, ht) * 4) }),
  putImageData() {}, drawImage() {}, setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
  beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {}, fill() {}, stroke() {},
  setLineDash() {}, fillText() {}, save() {}, restore() {}, translate() {}, scale() {},
};
w.HTMLCanvasElement.prototype.getContext = () => ctx;
w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
w.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 1100, height: 1100 * (this.height / this.width || 0.62), right: 1100, bottom: 700, x: 0, y: 0 }; };
w.HTMLElement.prototype.setPointerCapture = () => {};
w.HTMLElement.prototype.releasePointerCapture = () => {};
w.scrollTo = () => {};
w.print = () => {};
w.confirm = () => true;
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.fetch = (u, o) => fetch(new URL(u, base).href, o);
w.addEventListener("error", (e) => problems.push("window error: " + (e.error?.stack ?? e.message).split("\n").slice(0, 2).join(" | ")));
w.addEventListener("unhandledrejection", (e) => problems.push("unhandled rejection: " + String(e.reason)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => {
  const out = [];
  const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(n.tagName)) { for (const c of n.childNodes) walk(c); out.push(" "); } };
  walk(d.body);
  return out.join("").replace(/\s+/g, " ");
};
async function until(fn, ms = 6000, label = "") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch { /* keep waiting */ } await sleep(60); }
  throw new Error("timeout waiting for " + label);
}
const btn = (re) => [...d.querySelectorAll("button")].find((b) => (re instanceof RegExp ? re.test(b.textContent.trim()) : b.textContent.trim() === re));
const click = (re) => { const b = btn(re); if (!b) throw new Error("no button " + re); b.click(); };
const setVal = (el, v) => { const proto = el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(v)); el.dispatchEvent(new w.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); };
const go = async (hash, wait = 500) => {
  const before = d.querySelector("h1")?.textContent ?? "";
  w.location.hash = hash;
  await sleep(wait);
  if (hash !== "/") await until(() => (d.querySelector("h1")?.textContent ?? "") !== before, 12000, "page change to " + hash);
};
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`); };
const num = (re) => { const m = text().match(re); return m ? parseFloat(m[1]) : NaN; };

try {
  w.eval(code);
  await until(() => d.querySelector("h1"), 8000, "first render");

  // ---- every page renders its title
  const ROUTES = ["/", "/lab", "/whatif", "/layouts", "/hypotheses", "/cv", "/realdata", "/validation", "/notebook", "/experiments", "/guide", "/help", "/optimize", "/robustness", "/buildnotes"];
  for (const r of ROUTES) {
    await go(r, 200);
    try {
      await until(() => (d.querySelector("h1")?.textContent ?? "").length > 3 && text().length > 400, 15000, r);
      check(`page ${r} renders`, true, d.querySelector("h1").textContent.slice(0, 64));
    } catch (e) { check(`page ${r} renders`, false, e.message); }
  }

  // ---- Start Here
  await go("/", 500);
  const reached = () => num(/PITCH REACHED\s+(\d+)%/i);
  await until(() => reached() > 0, 5000, "coverage number");
  const c0 = reached();
  check("Start Here shows a pitch-reached number", c0 > 0, `${c0}%`);
  click("Bunch them up"); await sleep(300);
  const c1 = reached();
  check("Bunch them up lowers coverage", c1 < c0, `${c0}% -> ${c1}%`);
  click("4-4-2"); await sleep(300);
  check("Re-spreading restores coverage", reached() === c0, `${reached()}%`);
  const slider = d.querySelectorAll("input[type=range]")[0];
  setVal(slider, 6); await sleep(300);
  const c3 = reached();
  check("More time to arrive gives higher coverage", c3 > c0, `${c0}% -> ${c3}%`);
  setVal(slider, 3);
  click(/2 · Importance/); await sleep(300);
  check("Importance step shows weighted coverage", /Important spots reached\s+\d+%/i.test(text()), (text().match(/Important spots reached\s+\d+%/i) || [""])[0]);
  click(/1 · Reach/);
  // pointer drag of player 1 on the canvas
  const cv = d.querySelector("canvas");
  const fire = (type, x, y) => cv.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  fire("pointerdown", 1100 * 0.2, 1100 * 0.62 * 0.12); fire("pointermove", 800, 400); fire("pointerup", 800, 400); await sleep(300);
  check("Dragging a player marks the arrangement as your own", /now: your own/.test(text()));
  click(/player 3/i); await sleep(200);
  check("Sending a player off updates the count", /players on\s+9 \/ 10/i.test(text()), (text().match(/players on\s+\d+ \/ \d+/i) || [""])[0]);

  // ---- factory mode on Start Here
  click(/Factory/); await sleep(700);
  check("Factory mode shows stations and walking flow distance", /station/i.test(text()) && /walks\s+[\d.]+ m through S1/.test(text()), (text().match(/walks\s+[\d.]+ m through S1/) || [""])[0]);
  const flowBefore = num(/walks\s+([\d.]+) m through S1/);
  const layoutSel = [...d.querySelectorAll("select")].find((s) => [...s.options].some((o) => /U-shaped/.test(o.textContent)));
  setVal(layoutSel, "ushape"); await sleep(700);
  const flowAfter = num(/walks\s+([\d.]+) m through S1/);
  check("Changing the layout changes the flow distance", Number.isFinite(flowBefore) && Number.isFinite(flowAfter) && flowBefore !== flowAfter, `${flowBefore} m -> ${flowAfter} m`);
  click(/Soccer/); await sleep(500);

  // ---- The Lab: coach + save + log + reproduce
  await go("/lab", 300);
  await until(() => /Soft coverage/i.test(text()), 12000, "lab metrics");
  check("The Lab shows soft coverage and a bottleneck explanation", /Bottleneck explanation/i.test(text()));
  check("The Lab shows three main sliders plus a folded expert panel", /Three sliders/.test(text()) && /Expert parameters \(\d+\)/.test(text()));
  click(/Coach/); await sleep(200);
  click("Explain this page"); await sleep(1500);
  const dlg = d.querySelector("[role=dialog]")?.textContent ?? "";
  check("Coach answers on this server (offline template without a key)", /SIMULATED/.test(dlg) && /Offline template/.test(dlg), dlg.slice(0, 70));
  d.querySelector('[aria-label="Close coach"]').click();
  click("Record experiment");
  await until(() => /recorded as exp_|failed:/.test(text()), 8000, "save result");
  check("Record experiment saves through the PHP API", /recorded as exp_/.test(text()), (text().match(/recorded as exp_\w+|failed: [^ ]+( [^ ]+){0,6}/) || [""])[0]);
  await go("/experiments", 300);
  await until(() => /Recorded experiments \(\d+\)/.test(text()), 6000, "log");
  check("Experiment Log lists the saved run", /Recorded experiments \(1\)/.test(text()), (text().match(/Recorded experiments \(\d+\)/) || [""])[0]);
  click("open"); await until(() => btn(/Reproduce/), 4000, "open record");
  click(/Reproduce/);
  await until(() => /MATCH|MISMATCH|failed/.test(text()), 20000, "reproduce");
  const rep = (text().match(/(MISMATCH|MATCH)[^.]*\./) || [""])[0];
  check("Reproduce re-runs the stored settings and the hash MATCHes", /^MATCH/.test(rep), rep.slice(0, 80));

  // ---- Layouts
  await go("/layouts", 400);
  await until(() => /Five measures, side by side/.test(text()), 12000, "layouts");
  check("Factory Layouts compares 3 layouts on 5 measures", (text().match(/Linear flow line|U-shaped cell|Functional/g) || []).length >= 3 && /Product flow distance/.test(text()));

  // ---- What-If has a run control
  await go("/whatif", 400);
  await until(() => btn(/Run/), 6000, "whatif run button");
  check("What-If page offers a Run button", true);

  // ---- Real data
  await go("/realdata", 300);
  click(/Load SYNTHETIC/); await sleep(1200);
  const est = num(/Top speed \(est\.\)\s+([\d.]+) m\/s/i);
  check("Real Match Data estimates a top speed near the synthetic truth (8 m/s)", Math.abs(est - 8) < 1, `${est} m/s`);
  click(/Use these in The Lab/); await sleep(300);
  check("Estimated speeds can be applied to The Lab", /Applied: The Lab now uses top speed/.test(text()));
  await go("/lab", 300);
  await until(() => /Soft coverage/i.test(text()), 12000, "lab again");
  check("The Lab picked up the estimated top speed", /Top speed\s+[\d.]+ m\/s/.test(text()) && !/Top speed\s+7\.50 m\/s/.test(text()), (text().match(/Top speed\s+[\d.]+ m\/s/) || [""])[0]);

  // ---- Study Guide, Help, Notebook
  await go("/guide", 400);
  check("Study Guide shows an idea with formula, derivation and tutor prompts", /Prompts for an AI tutor/.test(text()) && /derive by hand/.test(text()));
  const gb = [...d.querySelectorAll("nav[aria-label=Ideas] button")];
  check("Study Guide lists 14 ideas", gb.length === 14, `${gb.length} buttons`);
  gb[13]?.click(); await sleep(150);
  check("Study Guide switches ideas", /Verification|validation/i.test(text().slice(0, 4000)));
  await go("/help", 400);
  const tabs = [...d.querySelectorAll("[role=tab]")];
  let helpOk = tabs.length === 6;
  for (const t of tabs) { t.click(); await sleep(80); if (!((d.querySelector("article.md")?.textContent.length ?? 0) > 500)) helpOk = false; }
  check("Help renders markdown for all six documents", helpOk, `${tabs.length} tabs`);
  await go("/notebook", 300);
  setVal(d.querySelector("textarea"), "Reach is how much pitch we can get to in time."); await sleep(900);
  check("Notebook script is built only from typed text; empty fields stay as [blanks]", /Reach is how much pitch/.test(text()) && /\[reach: your result\]/.test(text()));
  check("Notebook persists to localStorage", /Reach is how much pitch/.test(w.localStorage.getItem("ie_notebook_v1") ?? ""));

  // ---- nav: advanced group collapsed by default and opens on demand
  await go("/", 300);
  check("Advanced group is collapsed by default", !/Monte Carlo/.test(d.querySelector("aside").textContent));
  click(/Advanced/); await sleep(100);
  check("Advanced group opens and lists Optimization, Monte Carlo, Build Notes", /Optimization/.test(d.querySelector("aside").textContent) && /Monte Carlo/.test(d.querySelector("aside").textContent) && /Build Notes/.test(d.querySelector("aside").textContent));
} catch (e) {
  console.log("HARNESS ERROR", e.stack ?? e);
  results.push({ name: "harness", ok: false });
} finally {
  const uniq = [...new Set(problems)];
  console.log(`\n${uniq.length} runtime problems`);
  uniq.slice(0, 20).forEach((p) => console.log(" -", p));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  w.close();
  process.exit(failed || uniq.length ? 1 : 0);
}
