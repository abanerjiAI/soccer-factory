// Captures the showcase screenshots from a running site (static + PHP API), over CDP.
// usage: node tools/capture-shots.mjs [baseUrl] [outDir] [debugPort]
// Opens its own tab and closes only that tab. Leaves the app's own defaults (seed 42) alone.
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const out = path.resolve(process.argv[3] ?? "docs");
const PORT = process.argv[4] ?? "9222";
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const p = path.join(out, name + ".png");
  fs.writeFileSync(p, Buffer.from(r.data, "base64"));
  console.log("saved", p);
};
const go = async (hash, wait = 1500) => { await ev(`location.hash = ${JSON.stringify(hash)}`); await sleep(wait); };
const clickText = (re, sel = "button") => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>${re}.test(x.innerText.trim())); if(!b) return false; b.click(); return true;})()`);
const scrollTo = async (selector, block = "start") => { await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.scrollIntoView({block:${JSON.stringify(block)}}); return true;})()`); await sleep(600); };
const scrollBy = async (y) => { await ev(`window.scrollTo(0, ${y})`); await sleep(500); };

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: base });
await sleep(2200);

// ---- 1. Start Here, soccer (defaults: 4-4-2, 3 s, 6 m/s)
await go("/", 1600);
if ((await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Soccer/.test(x.innerText)); return b?.getAttribute('aria-pressed');})()`)) !== "true") await clickText(/Soccer/);
await sleep(1200);
await scrollBy(0);
await shot("sf-start-soccer");

// ---- 2. Start Here, factory (same engine, walking speed)
await clickText(/Factory/); await sleep(1600);
await scrollBy(0);
await shot("sf-start-factory");

// ---- 3/4. Layouts page, both modes (table visible)
await go("/layouts", 3500);
if ((await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Soccer/.test(x.innerText)); return b?.getAttribute('aria-pressed');})()`)) !== "true") await clickText(/Soccer/);
await sleep(2500);
await scrollTo("table", "center");
await shot("sf-formations-soccer");
await clickText(/Factory/); await sleep(3000);
await scrollTo("table", "center");
await shot("sf-layouts-factory");

// ---- 5. What-If: two players sent off
await clickText(/Soccer/); await sleep(800);
await go("/whatif", 3000);
const sum = `(()=>{const tr=[...document.querySelectorAll('tr')].find(r=>r.innerText.indexOf('Player(s) unavailable')>=0); return tr;})()`;
await ev(`(()=>{const tr=${sum}; const cb=tr.querySelector('input[type=checkbox]'); if(cb && !cb.checked) cb.click(); for (const i of [8,9]) { const b=[...tr.querySelectorAll('button')].find(x=>x.innerText.trim()===String(i)); if(b) b.click(); } return true;})()`);
await sleep(500);
await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.innerText.indexOf('Repeated trials')>=0); const el=l?.querySelector('input[type=range]'); if(!el) return null; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'10'); el.dispatchEvent(new Event('input',{bubbles:true})); return el.value;})()`);
await sleep(400);
await clickText(/Run scenarios/);
await sleep(12000);
await ev(`(()=>{const h=[...document.querySelectorAll('h2')].find(e=>/Baseline/i.test(e.innerText)); h?.scrollIntoView({block:'start'}); window.scrollBy(0,-90);})()`);
await sleep(700);
await shot("sf-whatif-redcard");

// ---- 6. What-If: one operator absent
await go("/whatif", 400);
await clickText(/Factory/); await sleep(2200);
await ev(`(()=>{const tr=[...document.querySelectorAll('tr')].find(r=>r.innerText.indexOf('Operator(s) unavailable')>=0); const cb=tr.querySelector('input[type=checkbox]'); if(cb && !cb.checked) cb.click(); const b=[...tr.querySelectorAll('button')].find(x=>x.innerText.trim()==='2'); if(b) b.click(); return true;})()`);
await sleep(500);
await ev(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.innerText.indexOf('Repeated trials')>=0); const el=l?.querySelector('input[type=range]'); if(!el) return null; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'10'); el.dispatchEvent(new Event('input',{bubbles:true})); return el.value;})()`);
await sleep(400);
await clickText(/Run scenarios/);
await sleep(12000);
await ev(`(()=>{const h=[...document.querySelectorAll('h2')].find(e=>/Baseline/i.test(e.innerText)); h?.scrollIntoView({block:'start'}); window.scrollBy(0,-90);})()`);
await sleep(700);
await shot("sf-whatif-breakdown");

// ---- 7. The Lab, soccer: the bottleneck callout
await go("/lab", 4500);
if ((await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Soccer/.test(x.innerText)); return b?.getAttribute('aria-pressed');})()`)) !== "true") await clickText(/Soccer/);
await sleep(2500);
await scrollBy(0);
await shot("sf-lab-soccer");

// ---- 8. Worked examples
await go("/examples", 2000);
await scrollBy(0);
await shot("sf-examples");

// ---- 9. The Coach, locked behind one sum
await ev(`localStorage.removeItem('ie_coach_gate')`);
await clickText(/Coach/); await sleep(400);
await clickText(/^Explain this page$/); await sleep(2500);
await shot("sf-coach-gate");
await ev(`document.querySelector('[aria-label="Close coach"]')?.click()`);

// ---- 10. Phone
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go("/", 2200);
await scrollBy(0);
await shot("sf-mobile");

await ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
console.log("done");
