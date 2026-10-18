// Runs Vite with two workarounds for locked-down Windows machines (harmless elsewhere):
//  1. Vite calls `net use` once to detect mapped network drives; some security tools refuse that spawn (EPERM) and Vite then
//     crashes. We answer that single call with "no mapped drives" and leave every other spawn untouched.
//  2. `--configLoader native` loads vite.config.ts directly instead of bundling it (the bundler cannot read Tailwind's native .node file).
// usage: node tools/vite.mjs [build|preview|...]
import cp from "node:child_process";
import module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const realExec = cp.exec;
cp.exec = function (cmd, ...rest) {
  if (typeof cmd === "string" && /^net use\b/i.test(cmd)) {
    const cb = rest.find((r) => typeof r === "function");
    if (cb) queueMicrotask(() => cb(new Error("skipped: net use not needed"), "", ""));
    return { on() {}, kill() {} };
  }
  return realExec.call(this, cmd, ...rest);
};
module.syncBuiltinESMExports();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!args.includes("--configLoader")) args.push("--configLoader", "native");
process.argv = [process.argv[0], path.join(root, "node_modules", "vite", "bin", "vite.js"), ...args];
await import(pathToFileURL(path.join(root, "node_modules", "vite", "bin", "vite.js")).href);
