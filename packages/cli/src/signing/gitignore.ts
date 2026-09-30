import fs from "node:fs";
import path from "node:path";
import { CommandError, run } from "../utils/exec.js";

export type IgnoreState = "ignored" | "not-ignored" | "unknown";

/** Asks git, which knows every nested and global ignore file. `unknown` outside a repository. */
export async function gitIgnoreState(appDir: string, relative: string): Promise<IgnoreState> {
  try {
    await run("git", ["check-ignore", "-q", "--no-index", relative], { cwd: appDir });
    return "ignored";
  } catch (error) {
    return error instanceof CommandError && error.code === 1 ? "not-ignored" : "unknown";
  }
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

/**
 * Whether a `.gitignore` body ignores `relative`, for when git cannot be asked. Recognises the
 * plain forms people write for this: the path, its basename, a `*.pem` glob, its directory.
 */
export function gitignoreCovers(contents: string, relative: string): boolean {
  const target = toPosix(relative);
  const base = path.posix.basename(target);
  const dir = path.posix.dirname(target);
  const accepted = new Set([
    target,
    `/${target}`,
    base,
    `**/${base}`,
    `*${path.posix.extname(base)}`,
    `${dir}/`,
    `/${dir}/`,
    dir,
    `/${dir}`,
  ]);

  let covered = false;
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      if (accepted.has(line.slice(1))) covered = false;
      continue;
    }
    if (accepted.has(line)) covered = true;
  }
  return covered;
}

/** `.gitignore` with `relative` appended, or null when nothing needs to change. */
export function ignorePatch(before: string | null, relative: string): string | null {
  const current = before ?? "";
  if (gitignoreCovers(current, relative)) return null;
  const separator = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  return `${current}${separator}${toPosix(relative)}\n`;
}

export function readGitignore(appDir: string): string | null {
  const file = path.join(appDir, ".gitignore");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}
