// Real-browser checks over CDP against an ALREADY RUNNING Chrome (started with --remote-debugging-port=9222).
// Opens its own tab and closes only that tab. Visits every page, collects console errors / exceptions / failed requests,
// takes screenshots, runs interaction checks, and tests a phone-sized viewport for horizontal overflow.
// usage: node tools/browser-check.mjs [baseUrl] [outDir] [debugPort]
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const out = path.resolve(process.argv[3] ?? "shots");
const PORT = process.argv[4] ?? "9222";
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
  else if (d.method) events.push(d);
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(out, name + ".png"), Buffer.from(r.data, "base64")); };
const go = async (hash, wait = 700) => { events.length = 0; await ev(`location.hash = ${JSON.stringify(hash)}`); await sleep(wait); };
const text = () => ev(`document.body.innerText.replace(/\\s+/g,' ')`);
const problems = [];
const collect = (label) => {
  for (const e of events) {
    if (e.method === "Runtime.exceptionThrown") problems.push(`${label}: EXCEPTION ${e.params.exceptionDetails.exception?.description?.split("\n")[0] ?? e.params.exceptionDetails.text}`);
    if (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") problems.push(`${label}: console.error ${e.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200)}`);
    if (e.method === "Network.loadingFailed" && !/favicon/.test(e.params.errorText ?? "") && !e.params.canceled) problems.push(`${label}: request failed ${e.params.errorText}`);
    if (e.method === "Network.responseReceived" && e.params.response.status >= 400 && !/favicon/.test(e.params.response.url)) problems.push(`${label}: HTTP ${e.params.response.status} ${e.params.response.url}`);
  }
};
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`); };
const clickText = (re, sel = "button") => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>${re}.test(x.innerText.trim())); if(!b) return false; b.click(); return true;})()`);
const setRange = (i, v) => ev(`(()=>{const el=document.querySelectorAll('input[type=range]')[${i}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'${v}'); el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });

try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base });
  await sleep(1800);

  const ROUTES = ["/", "/examples", "/lab", "/whatif", "/layouts", "/hypotheses", "/cv", "/realdata", "/validation", "/notebook", "/experiments", "/guide", "/help", "/optimize", "/robustness", "/buildnotes"];
  for (const r of ROUTES) {
    await go(r, ["/lab", "/whatif", "/validation", "/layouts", "/cv"].includes(r) ? 3000 : 900);
    const h1 = await ev(`document.querySelector('h1')?.innerText ?? ''`);
    const len = await ev(`document.body.innerText.length`);
    collect(r);
    check(`page ${r} renders`, h1.length > 3 && len > 300, h1.slice(0, 70));
    await shot("page" + (r === "/" ? "-start" : r.replace(/\//g, "-")));
  }

  // ---- Start Here: interactions
  await go("/", 800);
  const reached = async () => { const t = await text(); const m = t.match(/PITCH REACHED\s+(\d+)%/i) || t.match(/pitch reached\s+(\d+)%/i); return m ? +m[1] : NaN; };
  const c0 = await reached();
  check("Start Here shows a pitch-reached number", c0 > 0, `${c0}%`);
  await clickText(/^Bunch them up$/); await sleep(400);
  const c1 = await reached(); await shot("start-bunched");
  check("Bunch them up lowers coverage", c1 < c0, `${c0}% -> ${c1}%`);
  await clickText(/^4-4-2$/); await sleep(400);
  check("Re-spreading restores coverage", (await reached()) === c0);
  await setRange(0, 6); await sleep(400);
  const c3 = await reached();
  check("More time to arrive gives higher coverage", c3 > c0, `${c0}% -> ${c3}%`);
  await setRange(0, 3);
  await clickText(/2 · Importance/); await sleep(500);
  check("Importance step shows weighted coverage", /Important spots reached\s+\d+%/i.test(await text()));
  await shot("start-importance");
  await clickText(/1 · Reach/); await sleep(300);
  const box = await ev(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}})()`);
  await mouse("mousePressed", box.x + 0.2 * box.w, box.y + 0.12 * box.h);
  await mouse("mouseMoved", box.x + 0.5 * box.w, box.y + 0.5 * box.h);
  await mouse("mouseMoved", box.x + 0.8 * box.w, box.y + 0.8 * box.h);
  await mouse("mouseReleased", box.x + 0.8 * box.w, box.y + 0.8 * box.h);
  await sleep(500);
  check("Dragging a player on the canvas marks the arrangement as your own", /now: your own/.test(await text()));
  await shot("start-dragged");
  await clickText(/player 3/i); await sleep(300);
  check("Sending a player off updates the count", /players on\s+9 \/ 10/i.test(await text()));
  collect("start");

  // ---- Factory mode
  await clickText(/Factory/); await sleep(900);
  const ft = await text();
  check("Factory mode shows stations and walking flow distance", /station/i.test(ft) && /walks\s+[\d.]+ m through S1/.test(ft), (ft.match(/walks\s+[\d.]+ m through S1/) || [""])[0]);
  await shot("start-factory");
  await ev(`(()=>{const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>/U-shaped/.test(o.textContent))); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'ushape'); s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(900);
  const ft2 = await text();
  check("Changing the layout changes the flow distance", (ft2.match(/walks\s+([\d.]+) m/) || [])[1] !== (ft.match(/walks\s+([\d.]+) m/) || [])[1], `${(ft.match(/walks\s+([\d.]+) m/) || [])[1]} -> ${(ft2.match(/walks\s+([\d.]+) m/) || [])[1]}`);
  await shot("start-factory-u");
  collect("factory");
  await clickText(/Soccer/); await sleep(400);

  // ---- Layouts page honours the toggle: five formations on a pitch, three layouts on a floor
  await go("/layouts", 3500);
  const lt = await ev(`document.querySelector('table')?.innerText ?? ''`);
  check("Layouts compares five formations with the toggle on Soccer", /4-3-3/.test(lt) && /REACH IN 3 S/.test(lt), lt.slice(0, 60).replace(/\n/g, " "));
  await shot("layouts-soccer");
  await clickText(/Factory/); await sleep(3500);
  const lf = await ev(`document.querySelector('table')?.innerText ?? ''`);
  check("The same page compares three layouts on Factory", /Linear flow line/.test(lf) && /PRODUCT FLOW DISTANCE/.test(lf), lf.slice(0, 60).replace(/\n/g, " "));
  await clickText(/Soccer/); await sleep(600);

  // ---- Lab, coach, save, log, reproduce
  await go("/lab", 3000);
  await clickText(/Soccer/);
  await sleep(2500);
  check("The Lab shows soft coverage and a bottleneck explanation", /Soft coverage/i.test(await text()) && /Bottleneck explanation/i.test(await text()));
  await shot("lab");
  await clickText(/Coach/); await sleep(300);
  // start locked every run, so the gate path itself is what gets tested
  await ev(`localStorage.removeItem('ie_coach_gate')`);
  await clickText(/^Explain this page$/); await sleep(2200);
  let dlg = await ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
  if (/Live AI is locked/.test(dlg)) {
    const m = dlg.match(/(\d+)\s*\+\s*(\d+)\s*=/);
    check("Coach asks one sum before spending the paid AI", !!m, m ? `${m[1]} + ${m[2]}` : "no sum shown");
    const typeSum = (v) =>
      ev(`(()=>{const d=document.querySelector('[role=dialog]'); const i=[...d.querySelectorAll('input')].find(x=>(x.getAttribute('aria-label')||'').startsWith('What is')); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'${v}'); i.dispatchEvent(new Event('input',{bubbles:true})); return i.value;})()`);
    const pressUnlock = () => ev(`(()=>{const d=document.querySelector('[role=dialog]'); const b=[...d.querySelectorAll('button')].find(x=>x.innerText.trim()==='Unlock'); if(!b) return false; b.click(); return true;})()`);
    await typeSum(String(Number(m[1]) + Number(m[2]) + 1));
    await pressUnlock(); await sleep(1200);
    const bad = await ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
    check("A wrong sum is refused and the gate stays up", /not right|expired|wrong/i.test(bad) && /Live AI is locked/.test(bad), (bad.match(/That sum[^.]*\./) || [""])[0]);
    await typeSum(String(Number(m[1]) + Number(m[2])));
    await pressUnlock(); await sleep(8000);
    dlg = await ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
    check("The right sum unlocks a live AI answer", /AI-written \(DeepSeek/.test(dlg), dlg.slice(0, 80).replace(/\n/g, " "));
    await shot("coach-gate");
  } else {
    check("Coach answers (offline template, or live AI already unlocked)", /AI-written \(DeepSeek/.test(dlg) || /Offline template/.test(dlg), dlg.slice(0, 70).replace(/\n/g, " "));
  }
  await shot("coach");
  await ev(`document.querySelector('[aria-label="Close coach"]').click()`);
  await clickText(/^Record experiment$/); await sleep(1500);
  const st = (await text()).match(/recorded as exp_\w+|failed: [^ ]+( [^ ]+){0,6}/)?.[0] ?? "";
  check("Record experiment saves through the PHP API", /recorded as exp_/.test(st), st);
  await go("/experiments", 1000);
  const logN = +(((await text()).match(/Recorded experiments \((\d+)\)/) || [])[1] ?? 0);
  check("Experiment Log lists the saved run", logN >= 1, `${logN} record(s) in this browser`);
  await clickText(/^open$/, "button"); await sleep(700);
  await clickText(/Reproduce/); await sleep(3500);
  const rep = ((await text()).match(/(MISMATCH|MATCH)[^.]*\./) || [""])[0];
  check("Reproduce re-runs the stored settings and the hash MATCHes", /^MATCH/.test(rep), rep.slice(0, 80));
  await shot("log-reproduce");
  collect("save/reproduce");

  // ---- What-If: press Run and look
  await go("/whatif", 3000);
  await clickText(/^Run/); await sleep(6000);
  await shot("whatif-run");
  check("What-If run produces a comparison table", /integrated|baseline|recovery/i.test(await text()));
  collect("whatif");

  // ---- Test an Idea: run H1
  await go("/hypotheses", 1000);
  await clickText(/^Run/); await sleep(8000);
  const ht = await text();
  check("Test an Idea computes a verdict", /SUPPORTED|NOT SUPPORTED|INCONCLUSIVE/.test(ht));
  await shot("hypotheses-run");
  collect("hypotheses");

  // ---- Real data
  await go("/realdata", 600);
  await clickText(/Load SYNTHETIC/); await sleep(1800);
  const rt = await text();
  const est = +((rt.match(/Top speed \(est\.\)\s+([\d.]+) m\/s/i) || [])[1] ?? NaN);
  check("Real Match Data estimates a top speed near the synthetic truth (8 m/s)", Math.abs(est - 8) < 1, `${est} m/s`);
  await shot("realdata-loaded");
  collect("realdata");

  // ---- Worked examples
  await go("/examples", 1500);
  const ex = await text();
  check("Worked Examples page shows four examples in D to A order", /Example 1 · A team sheet/.test(ex) && /Example 4 · How much ground/.test(ex));
  check("Every example states what it cannot tell you", (ex.match(/cannot tell you, and cannot replicate/g) || []).length === 4, `${(ex.match(/cannot tell you, and cannot replicate/g) || []).length} of 4`);
  await shot("examples");
  await clickText(/^Load this setup$/); await sleep(3000);
  const loaded = { hash: await ev("location.hash"), h1: await ev(`document.querySelector('h1')?.innerText ?? ''`) };
  check("Load this setup opens the matching page in soccer mode", loaded.hash === "#/layouts" && /Formations/.test(loaded.h1), `${loaded.hash} · ${loaded.h1.slice(0, 40)}`);
  collect("examples");

  // ---- Guide / Help / Notebook
  await go("/guide", 800);
  await shot("guide");
  const nBtn = await ev(`document.querySelectorAll('nav[aria-label=Ideas] button').length`);
  check("Study Guide lists 14 ideas", nBtn === 14, `${nBtn}`);
  await go("/help", 800);
  await shot("help");
  await go("/notebook", 500);
  await ev(`(()=>{const t=document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Reach is how much pitch we can get to in time.'); t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(900);
  const nb = await text();
  check("Notebook script uses only typed text; blanks stay blanks", /Reach is how much pitch/.test(nb) && /\[reach: your result\]/.test(nb));
  await shot("notebook");
  collect("guide/help/notebook");

  // ---- phone viewport
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  for (const r of ["/", "/lab", "/layouts", "/guide", "/notebook"]) {
    await go(r, 1800);
    const o = await ev(`document.documentElement.scrollWidth - window.innerWidth`);
    check(`Phone: ${r} has no horizontal overflow`, o <= 2, `overflow ${o}px`);
    if (r === "/" || r === "/lab") await shot("mobile" + (r === "/" ? "-start" : "-lab"));
  }
  collect("mobile");
} catch (e) {
  console.log("HARNESS ERROR", e.stack ?? e);
  results.push({ name: "harness", ok: false });
} finally {
  const uniq = [...new Set(problems)];
  console.log(`\n${uniq.length} browser problems`);
  uniq.forEach((p) => console.log(" -", p));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  try { ws.close(); } catch { /* closing */ }
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`); } catch { /* tab already gone */ }
  process.exit(failed || uniq.length ? 1 : 0);
}
