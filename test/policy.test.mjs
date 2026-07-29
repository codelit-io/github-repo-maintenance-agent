import assert from "node:assert/strict";
import { test } from "node:test";
import { safeBranchName, validatePatch } from "../src/patch-policy.mjs";

const config = {
  allowedPaths: ["src/", "test/"],
  blockedPaths: [".github/workflows/", ".env"],
  maxPatchBytes: 20_000,
  maxChangedFiles: 2,
  maxChangedLines: 30,
};
const valid = `diff --git a/src/message.js b/src/message.js
index 1111111..2222222 100644
--- a/src/message.js
+++ b/src/message.js
@@ -1 +1 @@
-export const message = "Hello";
+export const message = "Hello from Codelit";
`;

test("accepts a bounded text patch", () => {
  assert.deepEqual(validatePatch(valid, config).files, ["src/message.js"]);
});

test("blocks workflows and out-of-scope files", () => {
  const workflow = valid.replaceAll("src/message.js", ".github/workflows/release.yml");
  assert.throws(() => validatePatch(workflow, config), /blocked path/);
  const outside = valid.replaceAll("src/message.js", "docs/message.md");
  assert.throws(() => validatePatch(outside, config), /outside allowedPaths/);
});

test("rejects traversal, binary, and quoted path forms", () => {
  assert.throws(() => validatePatch(valid.replaceAll("src/message.js", "src/../secret"), config), /Unsafe/);
  assert.throws(() => validatePatch(valid + "\nGIT binary patch\n", config), /Binary/);
  assert.throws(() => validatePatch(valid.replace("a/src/message.js b/src/message.js", '"a/src/my file.js" "b/src/my file.js"'), config), /Quoted/);
});

test("creates a stable review branch name", () => {
  assert.equal(safeBranchName("Fix: Greeting overflow!"), "codelit/fix-greeting-overflow");
});
