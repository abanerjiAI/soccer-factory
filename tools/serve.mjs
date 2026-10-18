// Serves dist/ (static site + PHP API) locally with PHP's built-in server: http://127.0.0.1:8080/
// usage: node tools/serve.mjs [port]      (run `npm run package` first)
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPhp } from "./php.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] ?? "8080";
const child = spawn(findPhp(), ["-S", `127.0.0.1:${port}`, "-t", path.join(root, "dist")], { stdio: "inherit", env: { ...process.env, LAB_DB_PATH: process.env.LAB_DB_PATH ?? path.join(root, ".local-data", "lab.sqlite") } });
child.on("error", (e) => {
  console.error("Could not start PHP:", e.message);
  process.exit(1);
});
console.log(`Soccer Lab on http://127.0.0.1:${port}/  (data in ${process.env.LAB_DB_PATH ?? path.join(root, ".local-data")})`);
