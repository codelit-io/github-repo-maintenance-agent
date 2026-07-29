import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { applyProposal } from "../src/git.mjs";

const exec = promisify(execFile);

test("applies, verifies, and commits a safe proposal on a new branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "codelit-maintenance-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/message.txt"), "Hello\n");
  await exec("git", ["init", "-b", "main"], { cwd: root });
  await exec("git", ["config", "user.email", "test@codelit.io"], { cwd: root });
  await exec("git", ["config", "user.name", "Codelit Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "fixture"], { cwd: root });
  const patch = `diff --git a/src/message.txt b/src/message.txt
index e965047..d7e4df2 100644
--- a/src/message.txt
+++ b/src/message.txt
@@ -1 +1 @@
-Hello
+Hello from Codelit
`;
  const result = await applyProposal({
    root,
    title: "Update fixture greeting",
    patch,
    config: {
      allowedPaths: ["src/"],
      blockedPaths: [".github/workflows/"],
      verifyCommands: ['test "$(cat src/message.txt)" = "Hello from Codelit"'],
      maxPatchBytes: 20_000,
      maxChangedFiles: 2,
      maxChangedLines: 20,
    },
  });
  assert.equal(result.branch, "codelit/update-fixture-greeting");
  assert.equal(await readFile(join(root, "src/message.txt"), "utf8"), "Hello from Codelit\n");
  const log = await exec("git", ["log", "-1", "--pretty=%s"], { cwd: root });
  assert.match(log.stdout, /^fix: Update fixture greeting/);
});
