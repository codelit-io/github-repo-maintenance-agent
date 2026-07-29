import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultBlockedPaths = [
  ".env",
  ".git/",
  ".github/workflows/",
  ".npmrc",
  ".ssh/",
  "migrations/",
  "secrets/",
  "terraform/",
];

function stringList(value, field, allowEmpty = true) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(field + " must be an array of non-empty strings.");
  }
  if (!allowEmpty && !value.length) throw new Error(field + " cannot be empty.");
  return value.map((entry) => entry.trim());
}

export async function loadConfig(path = "maintenance.config.json", root = process.cwd()) {
  const source = JSON.parse(await readFile(resolve(root, path), "utf8"));
  const config = {
    contextPaths: stringList(source.contextPaths, "contextPaths", false),
    allowedPaths: stringList(source.allowedPaths, "allowedPaths", false),
    blockedPaths: Array.from(new Set([...defaultBlockedPaths, ...stringList(source.blockedPaths || [], "blockedPaths")])),
    verifyCommands: stringList(source.verifyCommands, "verifyCommands", false),
    maxContextBytes: Number(source.maxContextBytes || 250_000),
    maxPatchBytes: Number(source.maxPatchBytes || 120_000),
    maxChangedFiles: Number(source.maxChangedFiles || 5),
    maxChangedLines: Number(source.maxChangedLines || 1_200),
  };
  for (const field of ["maxContextBytes", "maxPatchBytes", "maxChangedFiles", "maxChangedLines"]) {
    if (!Number.isSafeInteger(config[field]) || config[field] <= 0) throw new Error(field + " must be a positive integer.");
  }
  return config;
}
