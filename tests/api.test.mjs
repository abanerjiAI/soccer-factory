// API tests against a running PHP server (started by tools/run-api-tests.mjs, which also provides a mock DeepSeek endpoint).
// Run: npm run test:api
import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.API_BASE;
const MOCK = process.env.MOCK_BASE;
assert.ok(base && MOCK, "run via: npm run test:api");
const mockCalls = { get: async () => (await fetch(`${MOCK}/__calls`)).json() };

const A = "client_aaaaaaaaaaaaaaaa1", B = "client_bbbbbbbbbbbbbbbb2";
const call = async (route, { method = "GET", client, body, token } = {}) => {
  const r = await fetch(`${base}?r=${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(client ? { "X-Client-Id": client } : {}), ...(token ? { "X-Gate-Token": token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

/** Answer the live-Coach gate once; the returned token is good for 24 h from this address. */
async function unlock() {
  const ch = await call("gate/challenge");
  assert.equal(ch.status, 200);
  if (!ch.json.required) return "";
  const sum = ch.json.a + ch.json.b;
  const ok = await call("gate/verify", { method: "POST", body: { a: ch.json.a, b: ch.json.b, exp: ch.json.exp, sig: ch.json.sig, answer: sum } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.ok(ok.json.token);
  return ok.json.token;
}
const rec = (over = {}) => ({ kind: "simulation", mode: "soccer", title: "Baseline", config: { a: 1 }, summary: { b: 2 }, resultHash: "abc12345", seed: 42, trials: 1, modelVersion: "1.0.0", softwareVersion: "1.0.0", ...over });

test("health reports sqlite and AI mode, never the key", async () => {
  const r = await call("health");
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.ai, "deepseek");
  assert.ok(!JSON.stringify(r.json).includes("sk-test-secret"));
});

test("saving needs a valid client id", async () => {
  assert.equal((await call("experiments", { method: "POST", body: rec() })).status, 400);
  assert.equal((await call("experiments", { method: "POST", client: "short", body: rec() })).status, 400);
});

test("create, list, open, delete: round trip keeps JSON intact", async () => {
  const c = await call("experiments", { method: "POST", client: A, body: rec({ config: { nested: { x: [1, 2, 3] } }, summary: { v: 0.5 } }) });
  assert.equal(c.status, 201);
  const id = c.json.id;
  const l = await call("experiments", { client: A });
  assert.equal(l.json.experiments.length, 1);
  assert.equal(l.json.experiments[0].resultHash, "abc12345");
  const o = await call(`experiments/${id}`, { client: A });
  assert.deepEqual(o.json.experiment.config, { nested: { x: [1, 2, 3] } });
  assert.equal(o.json.experiment.seed, 42);
  const d = await call(`experiments/${id}`, { method: "DELETE", client: A });
  assert.equal(d.json.deleted, 1);
  assert.equal((await call("experiments", { client: A })).json.experiments.length, 0);
});

test("one visitor cannot see or delete another visitor's runs", async () => {
  const c = await call("experiments", { method: "POST", client: A, body: rec({ title: "private" }) });
  const id = c.json.id;
  assert.equal((await call("experiments", { client: B })).json.experiments.length, 0);
  assert.equal((await call(`experiments/${id}`, { client: B })).status, 404);
  assert.equal((await call(`experiments/${id}`, { method: "DELETE", client: B })).json.deleted, 0);
  assert.equal((await call(`experiments/${id}`, { client: A })).status, 200);
});

test("input validation rejects bad kind, mode, stage, title, hash, seed", async () => {
  for (const bad of [{ kind: "nope" }, { mode: "mars" }, { stage: "x" }, { title: "" }, { resultHash: "" }, { seed: "7" }, { config: "str" }]) {
    const r = await call("experiments", { method: "POST", client: B, body: rec(bad) });
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test("SQL injection text is stored as plain text, tables survive", async () => {
  const c = await call("experiments", { method: "POST", client: B, body: rec({ title: "x'); DROP TABLE experiments;--" }) });
  assert.equal(c.status, 201);
  const l = await call("experiments", { client: B });
  assert.equal(l.json.experiments[0].title, "x'); DROP TABLE experiments;--");
});

test("per-client record cap (4) returns 429", async () => {
  const C = "client_cccccccccccccccc3";
  for (let i = 0; i < 4; i++) assert.equal((await call("experiments", { method: "POST", client: C, body: rec() })).status, 201);
  assert.equal((await call("experiments", { method: "POST", client: C, body: rec() })).status, 429);
});

let TOKEN = "";

test("the live Coach is locked until one sum is answered", async () => {
  const r = await call("ai/explain", { method: "POST", body: { topic: "Coverage", context: "coverage is 61%" } });
  assert.equal(r.status, 401);
  assert.equal(r.json.code, "gate_required");
  assert.equal(r.json.gate, true);
  assert.equal((await mockCalls.get()).length, 0, "no paid provider call may happen before the gate");
});

test("a wrong or stale sum is refused, a right one returns a 24 h token, a tampered one is rejected", async () => {
  const ch = await call("gate/challenge");
  assert.equal(ch.status, 200);
  assert.equal(ch.json.required, true);
  assert.ok(Number.isInteger(ch.json.a) && Number.isInteger(ch.json.b));

  const wrong = await call("gate/verify", { method: "POST", body: { a: ch.json.a, b: ch.json.b, exp: ch.json.exp, sig: ch.json.sig, answer: ch.json.a + ch.json.b + 1 } });
  assert.equal(wrong.status, 400);

  const stale = await call("gate/verify", { method: "POST", body: { a: ch.json.a, b: ch.json.b, exp: 1000, sig: ch.json.sig, answer: ch.json.a + ch.json.b } });
  assert.equal(stale.status, 400);

  TOKEN = await unlock();
  assert.ok(TOKEN.length > 60, "token looks too short");
  assert.equal((await call("gate/challenge")).json.exp - Math.floor(Date.now() / 1000) <= 300, true);

  const tampered = TOKEN.slice(0, -1) + (TOKEN.endsWith("a") ? "b" : "a");
  const rejected = await call("ai/explain", { method: "POST", token: tampered, body: { topic: "t", context: "c" } });
  assert.equal(rejected.status, 401);
  assert.equal((await mockCalls.get()).length, 0, "a tampered token must not reach the provider");
});

test("Coach calls DeepSeek with the right contract and returns its text", async () => {
  const calls0 = (await mockCalls.get()).length;
  const r = await call("ai/explain", { method: "POST", token: TOKEN, body: { topic: "Coverage", context: "coverage is 61%", audience: "highschool" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.source, "deepseek");
  assert.equal(r.json.text, "MOCK ANSWER");
  assert.ok(r.json.disclaimer.includes("NOT experimental evidence"));
  const m = (await mockCalls.get())[calls0];
  assert.equal(m.url, "/chat/completions");
  assert.equal(m.auth, "Bearer sk-test-secret");
  assert.equal(m.body.model, "deepseek-flash");
  assert.equal(m.body.stream, false);
  assert.match(m.body.messages[0].content, /ONLY the numbers/);
  assert.match(m.body.messages[1].content, /coverage is 61%/);
  assert.ok(!JSON.stringify(r.json).includes("sk-test-secret"));
});

test("Coach is rate limited per visitor (limit 3): the 4th answer is the offline template", async () => {
  // one call was used above; two more are allowed
  assert.equal((await call("ai/explain", { method: "POST", token: TOKEN, body: { topic: "t", context: "c" } })).json.source, "deepseek");
  assert.equal((await call("ai/explain", { method: "POST", token: TOKEN, body: { topic: "t", context: "c" } })).json.source, "deepseek");
  const over = await call("ai/explain", { method: "POST", token: TOKEN, body: { topic: "t", context: "c" } });
  assert.equal(over.json.source, "offline-template");
  assert.equal(over.json.limited, true);
  const before = (await mockCalls.get()).length;
  await call("ai/explain", { method: "POST", token: TOKEN, body: { topic: "t", context: "c" } });
  assert.equal((await mockCalls.get()).length, before, "no provider call once limited");
});

test("Coach input checks and truncation", async () => {
  assert.equal((await call("ai/explain", { method: "POST", body: { topic: 5 } })).status, 400);
  assert.equal((await call("ai/explain", { method: "POST", body: "not-an-object" })).status, 400);
});

test("unknown routes are 404 JSON, not PHP errors", async () => {
  const r = await call("nothing/here", { client: A });
  assert.equal(r.status, 404);
  assert.ok(r.json.error);
});
