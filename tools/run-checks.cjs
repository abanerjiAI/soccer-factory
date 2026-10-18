// Compiles nothing: run `npm run test:build` first (tsc -> .build-test). Prints every verification case.
const path = require("node:path");
const { runValidationSuite } = require(path.join(__dirname, "..", ".build-test", "web", "engine", "validation.js"));
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
runValidationSuite().then((cs) => {
  const bad = cs.filter((c) => !c.pass);
  console.log("TOTAL", cs.length, "PASS", cs.length - bad.length, "FAIL", bad.length);
  for (const c of cs.filter((c) => !only || only.test(c.id))) console.log((c.pass ? "PASS " : "FAIL ") + c.id + " | " + c.observed);
  process.exit(bad.length ? 1 : 0);
});
