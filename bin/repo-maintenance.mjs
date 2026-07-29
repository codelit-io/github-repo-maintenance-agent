#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { loadContext, loadIssue } from "../src/context.mjs";
import { applyProposal } from "../src/git.mjs";
import { proposePatch } from "../src/model.mjs";
import { validatePatch } from "../src/patch-policy.mjs";

function usage() {
  console.log(`GitHub Repo Maintenance Agent

Usage:
  repo-maintenance preview
  repo-maintenance plan --issue <brief.md> [--config maintenance.config.json]
  repo-maintenance apply [--patch .codelit/proposal.patch] [--config maintenance.config.json] [--draft-pr]

Plan calls your selected model and writes a proposal without changing the repo.
Apply is the explicit approval boundary: it creates a branch, validates and
applies the patch, runs configured checks, and optionally opens a draft PR.`);
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const args = process.argv.slice(2);
const command = args[0];
if (!command || args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}
if (command === "preview") {
  const workflow = JSON.parse(await readFile(new URL("../agent-workflow/workflow.json", import.meta.url), "utf8"));
  console.log("\n" + workflow.title + "\n" + workflow.description + "\n");
  for (const [index, step] of workflow.steps.entries()) {
    console.log(String(index + 1).padStart(2, "0") + ". " + step.title + " - " + step.action);
  }
  console.log("\nNo model, git write, or GitHub call was made.\n");
} else if (command === "plan") {
  const issuePath = option(args, "--issue");
  if (!issuePath) throw new Error("plan requires --issue <brief.md>.");
  const configPath = option(args, "--config", "maintenance.config.json");
  const config = await loadConfig(configPath);
  const issue = await loadIssue(issuePath);
  const context = await loadContext(config);
  const patch = await proposePatch({ issue: issue.source, context: context.source, config });
  const summary = validatePatch(patch, config);
  await mkdir(resolve(".codelit"), { recursive: true });
  await writeFile(resolve(".codelit/proposal.patch"), patch);
  await writeFile(resolve(".codelit/proposal.json"), JSON.stringify({
    title: issue.title,
    modelProvider: process.env.CODELIT_PROVIDER,
    model: process.env.CODELIT_MODEL,
    contextBytes: context.bytes,
    ...summary,
  }, null, 2) + "\n");
  console.log("Proposal created without changing the repository.");
  console.log("Review .codelit/proposal.patch, then run the apply command.");
} else if (command === "apply") {
  const config = await loadConfig(option(args, "--config", "maintenance.config.json"));
  const patchPath = option(args, "--patch", ".codelit/proposal.patch");
  const patch = await readFile(resolve(patchPath), "utf8");
  const metadata = JSON.parse(await readFile(resolve(".codelit/proposal.json"), "utf8"));
  const result = await applyProposal({
    patch,
    config,
    title: metadata.title || "Maintenance patch",
    draftPr: args.includes("--draft-pr"),
  });
  console.log("Approved patch committed on " + result.branch + ".");
  if (!args.includes("--draft-pr")) console.log("No remote push or pull request was created.");
} else {
  throw new Error("Unknown command: " + command);
}
