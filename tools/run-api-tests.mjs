// Starts PHP's built-in server on a scratch SQLite file plus a MOCK DeepSeek endpoint, runs tests/api.test.mjs against them, cleans up.
// Run: npm run test:api
// (The harness is a plain script rather than a node:test hook because some Windows setups refuse to spawn PHP from inside the test runner.)
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findPhp } from "./php.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8391, MOCK = 8392;
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "ie-api-"));
const calls = [];

const mock = http.createServer((req, res) => {
  if (req.url === "/__calls") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(calls)); return; }
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    calls.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b || "{}") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ model: "deepseek-flash", choices: [{ message: { content: "MOCK ANSWER" } }] }));
  });
});
await new Promise((r) => mock.listen(MOCK, "127.0.0.1", r));

fs.writeFileSync(path.join(tmp, "config.php"), `<?php return ['db_path' => ${JSON.stringify(path.join(tmp, "lab.sqlite"))}, 'deepseek_api_key' => 'sk-test-secret', 'deepseek_base_url' => 'http://127.0.0.1:${MOCK}', 'ai_per_ip_per_day' => 3, 'ai_global_per_day' => 5, 'max_records_per_client' => 4, 'ip_salt' => 'test'];`);
// some Windows setups refuse the first few child spawns (EPERM); retry before giving up
let php = null;
for (let attempt = 0; attempt < 8 && !php; attempt++) {
  php = spawn(findPhp(), ["-S", `127.0.0.1:${PORT}`, "-t", root], { env: { ...process.env, LAB_CONFIG: path.join(tmp, "config.php") }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 400));
  if (php.pid === undefined || php.exitCode !== null) php = null;
}
if (!php) { console.error("could not start PHP after retries"); process.exit(1); }
let failed = false;
php.on("error", (e) => { console.error("could not start PHP:", e.message); failed = true; });

const base = `http://127.0.0.1:${PORT}/api/index.php`;
let up = false;
for (let i = 0; i < 80 && !up && !failed; i++) {
  try { up = (await fetch(`${base}?r=health`)).ok; } catch { await new Promise((r) => setTimeout(r, 150)); }
}
let code = 1;
if (up) {
  // async on purpose: the mock DeepSeek server lives in THIS process and must keep answering while the tests run
  code = await new Promise((resolve) => {
    const t = spawn(process.execPath, ["--test", "tests/api.test.mjs"], { cwd: root, stdio: "inherit", env: { ...process.env, API_BASE: base, MOCK_BASE: `http://127.0.0.1:${MOCK}` } });
    t.on("exit", (c) => resolve(c ?? 1));
    t.on("error", () => resolve(1));
  });
} else console.error("PHP server did not come up");
php.kill();
mock.close();
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* sqlite file may still be locked on Windows */ }
process.exit(code);
