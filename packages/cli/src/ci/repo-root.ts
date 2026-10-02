import fs from "node:fs";
import path from "node:path";

/** The nearest directory at or above `start` holding `.git` (a directory, or a worktree's file); null outside a repository. */
export function findRepoRoot(start: string): string | null {
  let current = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** `dir` relative to `root` with forward slashes, `.` for the root itself; null when `dir` is outside `root`. */
export function relativeAppDir(root: string, dir: string): string | null {
  const relative = path.relative(path.resolve(root), path.resolve(dir));
  if (!relative) return ".";
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return relative.split(path.sep).join("/");
}
