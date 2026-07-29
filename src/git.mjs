import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { safeBranchName, validatePatch } from "./patch-policy.mjs";

function run(program, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: process.env,
      shell: Boolean(options.shell),
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(program + " exited " + code + (stderr ? ": " + stderr.trim() : "")));
    });
  });
}

export async function assertCleanRepository(root = process.cwd()) {
  const result = await run("git", ["status", "--porcelain"], { cwd: root, capture: true });
  if (result.stdout.trim()) throw new Error("Repository must be clean before applying a proposal.");
}

export async function applyProposal(options) {
  const root = resolve(options.root || process.cwd());
  const summary = validatePatch(options.patch, options.config);
  await assertCleanRepository(root);
  const branch = options.branch || safeBranchName(options.title);
  await run("git", ["switch", "-c", branch], { cwd: root });
  const artifactDir = resolve(root, ".codelit");
  await mkdir(artifactDir, { recursive: true });
  const patchPath = resolve(artifactDir, "approved.patch");
  await writeFile(patchPath, options.patch);
  await run("git", ["apply", "--check", patchPath], { cwd: root });
  await run("git", ["apply", "--whitespace=error", patchPath], { cwd: root });
  for (const command of options.config.verifyCommands) {
    await run(command, [], { cwd: root, shell: true });
  }
  await run("git", ["add", "--", ...summary.files], { cwd: root });
  await run("git", ["commit", "-m", "fix: " + options.title.slice(0, 68)], { cwd: root });
  if (options.draftPr) {
    await run("gh", ["auth", "status"], { cwd: root });
    await run("git", ["push", "-u", "origin", branch], { cwd: root });
    const bodyPath = resolve(artifactDir, "pr-body.md");
    await writeFile(bodyPath, [
      "## Scope",
      "",
      options.title,
      "",
      "## Safety boundary",
      "",
      "- Changed files: " + summary.files.join(", "),
      "- Verification: " + options.config.verifyCommands.join("; "),
      "- Draft only. Human review and merge are required.",
      "",
    ].join("\n"));
    await run("gh", ["pr", "create", "--draft", "--title", options.title, "--body-file", bodyPath], { cwd: root });
  }
  return { branch, summary };
}
