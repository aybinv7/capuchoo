/**
 * Putting the version files back when a deploy does not publish.
 *
 * A deploy writes two tracked files: `package.json`'s version, and the build
 * numbers in `version-code.json`. Both were written and then left behind on
 * failure, with the CLI printing "package.json was already bumped to 7.0.0.
 * Revert it with: git checkout -- package.json".
 *
 * That message is the bug. A tool that knows it left a file wrong should put it
 * back, not delegate the cleanup. Lowmaro went 5.0.0 -> 8.0.0 across three
 * failed attempts, and then 6.0.0 -> 7.0.0 on a fourth, because each one asked
 * the operator to undo it and the message is easy to miss in a wall of build
 * errors.
 *
 * Restoring is only correct while nothing has been published. Once a bundle is
 * uploaded, the version on disk is the version that exists on the server, and
 * rewinding it would make the next deploy publish that same version again.
 */

import fs from "node:fs";
import path from "node:path";

export interface FileSnapshot {
  file: string;
  /** null when the file did not exist, so restoring means deleting it. */
  content: string | null;
}

/**
 * The tracked files a deploy may rewrite.
 *
 * Read before anything is written, so the contents are what the working tree had
 * when the operator asked for the deploy.
 */
export function snapshotVersionFiles(
  appDir: string,
  versionCodeFile: string,
  androidDir = "android",
): FileSnapshot[] {
  return [
    path.join(appDir, "package.json"),
    path.resolve(appDir, versionCodeFile),
    // The native configuration step writes the version into the Gradle file and
    // the app name into strings.xml. Both are tracked, and both were left
    // claiming a release that was never published - a deploy that failed at the
    // upload left `versionCode 8 / versionName "0.5.1"` behind for a version
    // that does not exist. Less damaging than the package.json bump, because the
    // next deploy rewrites them, but it is the same defect and the same fix.
    path.join(appDir, androidDir, "app", "build.gradle"),
    path.join(appDir, androidDir, "app", "src", "main", "res", "values", "strings.xml"),
  ].map((file) => ({
    file,
    content: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null,
  }));
}

/**
 * Puts back whatever changed, and reports which files that was.
 *
 * A file that was not modified is left alone rather than rewritten, so a deploy
 * that failed before touching anything reports nothing and the working tree
 * keeps its original mtimes.
 */
export function restoreVersionFiles(snapshots: FileSnapshot[]): string[] {
  const restored: string[] = [];

  for (const { file, content } of snapshots) {
    const exists = fs.existsSync(file);

    if (content === null) {
      // Created by this deploy: removing it is the restore.
      if (exists) {
        fs.rmSync(file);
        restored.push(path.basename(file));
      }
      continue;
    }

    if (!exists || fs.readFileSync(file, "utf8") !== content) {
      fs.writeFileSync(file, content, "utf8");
      restored.push(path.basename(file));
    }
  }

  return restored;
}
