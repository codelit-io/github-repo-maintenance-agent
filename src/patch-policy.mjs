function normalizedPath(path) {
  if (!path || path === "/dev/null") return null;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0") || path.includes('"')) {
    throw new Error("Unsupported patch path: " + path);
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Unsafe patch path: " + path);
  }
  return path;
}

function matchesBoundary(path, boundary) {
  const clean = boundary.replace(/^\.\//, "");
  return clean.endsWith("/") ? path.startsWith(clean) : path === clean || path.startsWith(clean + "/");
}

export function validatePatch(patch, config) {
  if (typeof patch !== "string" || !patch.trim()) throw new Error("Patch is empty.");
  if (Buffer.byteLength(patch) > config.maxPatchBytes) throw new Error("Patch exceeds maxPatchBytes.");
  if (/GIT binary patch|Binary files .* differ/.test(patch)) throw new Error("Binary patches are not allowed.");
  if (/^(?:new|old) file mode 120000$/m.test(patch)) throw new Error("Symbolic-link patches are not allowed.");
  if (/^(?:new|old) file mode 160000$/m.test(patch)) throw new Error("Submodule patches are not allowed.");

  const files = new Set();
  const diffLines = patch.split("\n").filter((line) => line.startsWith("diff --git "));
  if (!diffLines.length) throw new Error("Expected a unified git diff beginning with diff --git.");
  for (const line of diffLines) {
    const match = line.match(/^diff --git a\/([^\t ]+) b\/([^\t ]+)$/);
    if (!match) throw new Error("Quoted, escaped, or space-containing patch paths are not supported.");
    for (const raw of match.slice(1)) {
      const path = normalizedPath(raw);
      if (path) files.add(path);
    }
  }
  for (const line of patch.split("\n")) {
    if (!line.startsWith("--- ") && !line.startsWith("+++ ")) continue;
    const raw = line.slice(4);
    if (raw === "/dev/null") continue;
    if (!raw.startsWith("a/") && !raw.startsWith("b/")) throw new Error("Unexpected diff header path: " + raw);
    const path = normalizedPath(raw.slice(2));
    if (path) files.add(path);
  }
  if (files.size > config.maxChangedFiles) throw new Error("Patch changes more than maxChangedFiles.");
  for (const path of files) {
    if (config.blockedPaths.some((boundary) => matchesBoundary(path, boundary))) {
      throw new Error("Patch touches blocked path: " + path);
    }
    if (!config.allowedPaths.some((boundary) => matchesBoundary(path, boundary))) {
      throw new Error("Patch is outside allowedPaths: " + path);
    }
  }
  const changedLines = patch.split("\n").filter((line) =>
    (line.startsWith("+") && !line.startsWith("+++"))
    || (line.startsWith("-") && !line.startsWith("---")),
  ).length;
  if (changedLines > config.maxChangedLines) throw new Error("Patch exceeds maxChangedLines.");
  return { files: Array.from(files).sort(), changedLines, bytes: Buffer.byteLength(patch) };
}

export function safeBranchName(title) {
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return "codelit/" + (slug || "maintenance-patch");
}
