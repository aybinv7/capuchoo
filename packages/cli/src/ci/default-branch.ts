import { run } from "../utils/exec.js";

const ORIGIN_PREFIX = "refs/remotes/origin/";

/** The branch named by `git symbolic-ref refs/remotes/origin/HEAD` output, or null. */
export function parseOriginHead(output: string): string | null {
  const ref = output.trim();
  if (!ref.startsWith(ORIGIN_PREFIX)) return null;
  return ref.slice(ORIGIN_PREFIX.length) || null;
}

/** The remote's default branch as the clone recorded it; null without git, a remote or that ref. */
export async function detectDefaultBranch(root: string): Promise<string | null> {
  try {
    const result = await run("git", ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], {
      cwd: root,
      timeoutMs: 5_000,
    });
    return parseOriginHead(result.stdout);
  } catch {
    return null;
  }
}
