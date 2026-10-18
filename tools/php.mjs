// Finds and runs PHP for this project.
// usage: node tools/php.mjs -l api/index.php      |     node tools/php.mjs -S 127.0.0.1:8081 -t dist
// Order: $PHP_BIN, Laragon's PHP (this workstation), then `php` on PATH. No probing: a probe spawn is blocked intermittently
// by Windows security tooling on this machine, so we only check that the file exists and let the real launch report errors.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function findPhp() {
  const cands = [process.env.PHP_BIN, "D:/Portable/Laragon_8.0.3/bin/php/php-8.3.26-Win32-vs16-x64/php.exe"].filter(Boolean);
  for (const c of cands) if (existsSync(c)) return c;
  return "php";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = spawnSync(findPhp(), process.argv.slice(2), { stdio: "inherit" });
  if (r.error) {
    console.error("Could not start PHP (" + r.error.message + "). Install PHP 8.1+ with pdo_sqlite or set PHP_BIN.");
    process.exit(127);
  }
  process.exit(r.status ?? 1);
}
