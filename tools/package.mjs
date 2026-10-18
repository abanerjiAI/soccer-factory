// Builds the site and assembles the deployable folder `dist/`: static front end + PHP API (without any secrets).
// usage: node tools/package.mjs            (npm run package)
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(process.execPath, [path.join(root, "tools", "vite.mjs"), "build"], { cwd: root, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

const dist = path.join(root, "dist");
const apiOut = path.join(dist, "api");
fs.rmSync(apiOut, { recursive: true, force: true });
fs.mkdirSync(apiOut, { recursive: true });
const SKIP = /^(config\.php|.*\.sqlite(-wal|-shm)?)$/;
for (const f of fs.readdirSync(path.join(root, "api"))) {
  if (SKIP.test(f)) continue;
  fs.copyFileSync(path.join(root, "api", f), path.join(apiOut, f));
}
// the SQLite folder is created on first use (api/db.php); ship a guard so it is never listed or downloaded on Apache
fs.mkdirSync(path.join(dist, "data"), { recursive: true });
fs.writeFileSync(path.join(dist, "data", ".htaccess"), "Require all denied\n");
fs.writeFileSync(path.join(dist, "data", "index.html"), "");
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /api/\nDisallow: /data/\n");

// manifest: every file with its checksum, handy for verifying a deploy byte-for-byte
const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (n !== "MANIFEST.json") files.push({ path: path.relative(dist, p).replace(/\\/g, "/"), bytes: fs.statSync(p).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") });
  }
})(dist);
fs.writeFileSync(path.join(dist, "MANIFEST.json"), JSON.stringify({ built: new Date().toISOString(), files }, null, 1));
console.log(`\npackaged ${files.length} files into ${dist}`);
