import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

function safePath(root, path) {
  if (!path || path.startsWith("/") || path.includes("\0")) throw new Error("Unsafe context path: " + path);
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (!rel || rel.startsWith("..") || rel.includes("\0")) throw new Error("Context path escapes the repository: " + path);
  return { absolute, relative: rel };
}

export async function loadIssue(path, root = process.cwd()) {
  const file = safePath(root, path);
  const source = await readFile(file.absolute, "utf8");
  if (Buffer.byteLength(source) > 30_000) throw new Error("Issue brief exceeds 30 KB.");
  const title = source.split("\n").map((line) => line.replace(/^#+\s*/, "").trim()).find(Boolean) || "Maintenance patch";
  return { title: title.slice(0, 120), source };
}

export async function loadContext(config, root = process.cwd()) {
  const sections = [];
  let bytes = 0;
  for (const path of config.contextPaths) {
    const file = safePath(root, path);
    const source = await readFile(file.absolute, "utf8");
    bytes += Buffer.byteLength(source);
    if (bytes > config.maxContextBytes) throw new Error("Repository context exceeds maxContextBytes.");
    if (source.includes("\0")) throw new Error("Binary context file is not allowed: " + path);
    sections.push("FILE: " + file.relative + "\n" + source);
  }
  return { source: sections.join("\n\n---\n\n"), bytes };
}
