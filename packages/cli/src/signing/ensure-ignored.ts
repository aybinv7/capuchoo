import path from "node:path";
import { confirm, log } from "../cli/prompts.js";
import { describePatch } from "../pipeline/wiring.js";
import { writeFileAtomic } from "../utils/secure-file.js";
import { gitIgnoreState, ignorePatch, readGitignore } from "./gitignore.js";

/**
 * Makes sure git ignores `relative` before a secret is written there. Shows the `.gitignore`
 * change and asks unless `assumeYes`; throws when declined or when git still would not ignore it.
 */
export async function ensureIgnored(
  appDir: string,
  relative: string,
  assumeYes: boolean,
): Promise<"already" | "added"> {
  const state = await gitIgnoreState(appDir, relative);
  if (state === "ignored") return "already";

  const before = readGitignore(appDir);
  const next = ignorePatch(before, relative);

  if (next === null) {
    if (state === "unknown") return "already";
    throw new Error(
      `.gitignore lists ${relative}, but git would still track it (a later "!" rule?). Fix that before a private key is written there.`,
    );
  }

  log.info(describePatch(".gitignore", before ?? "", next));
  const accepted =
    assumeYes || (await confirm("Write .gitignore?", { default: true, flag: "--yes" }));
  if (!accepted) {
    throw new Error(
      `${relative} must be git-ignored before the key is written. Nothing was written.`,
    );
  }

  writeFileAtomic(path.join(appDir, ".gitignore"), next);
  return "added";
}
