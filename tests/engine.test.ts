import { test } from "node:test";
import assert from "node:assert/strict";
import { runValidationSuite } from "../web/engine/validation";

// Every verification case is one node:test case. Run: npm test
test("verification suite", async (t) => {
  const cases = await runValidationSuite();
  for (const c of cases) {
    await t.test(`${c.id} [${c.group}] ${c.description}`, () => {
      assert.ok(c.pass, `expected: ${c.expected} | observed: ${c.observed}`);
    });
  }
});
