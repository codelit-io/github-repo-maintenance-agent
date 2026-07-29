import assert from "node:assert/strict";
import { test } from "node:test";
import { extractPatch } from "../src/model.mjs";

test("extracts one unfenced unified diff", () => {
  const output = "Here is the patch:\n```diff\ndiff --git a/src/a.js b/src/a.js\n--- a/src/a.js\n+++ b/src/a.js\n@@ -1 +1 @@\n-a\n+b\n```";
  assert.match(extractPatch(output), /^diff --git/);
  assert.doesNotMatch(extractPatch(output), /```/);
});

test("rejects prose-only model output", () => {
  assert.throws(() => extractPatch("I cannot make that change."), /did not return/);
});
