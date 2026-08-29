/**
 * The edits an app needs before it can receive an update, as pure functions.
 *
 * These three were printed as instructions and left for the operator to apply.
 * That does not work: every first run of this CLI - two of mine and one of the
 * user's - reached `deploy` and was refused for a missing VITE_UPDATE_API_URL,
 * because a wall of text after an install is not a step anybody performs.
 *
 * Pure on purpose. Each takes file content and returns the content it should
 * have, so the decision is testable against real files without a filesystem, and
 * the caller owns showing a diff and asking. A shape that is not recognised
 * returns `manual` rather than guessing - editing somebody's entry file badly is
 * worse than telling them what to add.
 */

export interface Patch {
  /** The new content, or null when nothing needs to change. */
  content: string | null;
  /** What happened, for the step report. */
  summary: string;
  /** Set when this cannot be done safely: the exact text to add by hand. */
  manual?: string;
  /** Set when the file already says something different and must not be overwritten. */
  conflict?: string;
}

const unchanged = (summary: string): Patch => ({ content: null, summary });

/** Whatever the file indents with, so an inserted line does not stand out. */
function indentOf(line: string): string {
  return /^(\s*)/.exec(line)?.[1] ?? "";
}

function readValue(content: string, key: string): string | null {
  const match = new RegExp(`^${key}=(.*)$`, "m").exec(content);
  return match ? (match[1]?.trim() ?? "") : null;
}

/**
 * Adds the two variables a flavour needs, and never overwrites either.
 *
 * A value that is already there and different is reported, not replaced. That
 * case is real: Lowmaro's `.env.local` still named the pre-rename `capucho-back`
 * host, and silently rewriting an operator's endpoint is not a fix, it is a
 * surprise.
 */
export function patchEnvFile(content: string, apiUrl: string, channel: string): Patch {
  const wanted: Array<[string, string]> = [
    ["VITE_UPDATE_API_URL", apiUrl],
    ["VITE_UPDATE_CHANNEL", channel],
  ];

  const conflicts = wanted
    .map(([key, value]) => {
      const present = readValue(content, key);
      return present !== null && present !== value ? `${key} is already ${present}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  const missing = wanted.filter(([key]) => readValue(content, key) === null);

  if (missing.length === 0) {
    return conflicts.length > 0
      ? { content: null, summary: "already set", conflict: conflicts.join("; ") }
      : unchanged("already set");
  }

  const lines = missing.map(([key, value]) => `${key}=${value}`);
  const block = [
    "",
    "# Capuchoo. Both are required: capuchooUpdaterConfig() refuses to build a",
    "# plugin block without them, and an empty updateUrl disables updates silently.",
    ...lines,
    "",
  ].join("\n");

  // After VITE_ENVIRONMENT when there is one, so the flavour's own settings stay
  // together. Otherwise at the end, which is always valid.
  const anchor = /^VITE_ENVIRONMENT=.*$/m.exec(content);
  const next = anchor
    ? content.slice(0, anchor.index + anchor[0].length) +
      block +
      content.slice(anchor.index + anchor[0].length + 1)
    : `${content.replace(/\s*$/, "")}\n${block}`;

  const patch: Patch = {
    content: next,
    summary: `+${lines.length} line${lines.length === 1 ? "" : "s"}`,
  };
  if (conflicts.length > 0) patch.conflict = conflicts.join("; ");

  return patch;
}

/**
 * A flavour env file that did not exist.
 *
 * `init` writes `project.json` pointing at `build/<env>/.env.<env>` for all three
 * flavours whether or not they exist, and the patcher above only ever edited
 * files that were already there - so a fresh app or a template got the pointer
 * and no file, and every deploy then failed on "does not set VITE_APP_ID". The
 * step that was meant to make an app deployable skipped the case where there was
 * most to do.
 *
 * Only the three values a deploy actually requires, plus the environment name
 * for convention. Anything else is the app's to add - this is a starting point,
 * not a template of someone else's settings.
 */
export function newEnvFile(environment: string, appId: string, apiUrl: string): string {
  return [
    `# ${environment} build. Created by capuchoo init.`,
    "",
    `VITE_APP_ID=${appId}`,
    `VITE_ENVIRONMENT=${environment}`,
    "",
    "# Capuchoo. Both are required: capuchooUpdaterConfig() refuses to build a",
    "# plugin block without them, and an empty updateUrl disables updates silently.",
    `VITE_UPDATE_API_URL=${apiUrl}`,
    `VITE_UPDATE_CHANNEL=${environment}`,
    "",
  ].join("\n");
}

const READY_IMPORT = 'import { notifyAppReady } from "@capuchoo/updater";';

/**
 * Calls `notifyAppReady()` before anything else runs.
 *
 * Placed after the imports and before the first statement, not merely "early":
 * behind an `await` it can miss the plugin's window, and the plugin then rolls
 * back to the previous bundle - so an update installs and silently reverts. It
 * is also deliberately not inside any condition.
 */
export function patchEntryFile(content: string): Patch {
  if (content.includes("notifyAppReady")) return unchanged("already calls notifyAppReady()");

  const call = [
    "// First, and never behind a condition or an await: it confirms the running",
    "// bundle booted. The plugin rolls back to the previous one if it does not",
    "// hear this within appReadyTimeout, so an update would install and revert.",
    "void notifyAppReady();",
  ].join("\n");

  const lines = content.split("\n");

  // The line after the last top-level import. A file with no imports gets both
  // at the top, which is still correct.
  let insertAt = 0;
  for (const [index, line] of lines.entries()) {
    if (/^\s*import\s/.test(line) || /^\s*}\s*from\s/.test(line)) insertAt = index + 1;
  }

  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);

  // The import goes above whatever the file already imports.
  return {
    content: [READY_IMPORT, ...before, "", call, ...after].join("\n"),
    summary: "added notifyAppReady()",
  };
}

export const INSTALL_PERMISSION = "android.permission.REQUEST_INSTALL_PACKAGES";

/**
 * Declares the permission an in-app APK install cannot happen without.
 *
 * `init --native` installs the four plugins that download and open an APK, and
 * the permission they need was only ever added by a Trapeze config. An app
 * configured by the built-in path got the plugins and not the permission, so it
 * downloaded a 9 MB update and then silently did nothing - `FileOpener.openFile`
 * resolves either way, so even the app could not tell.
 *
 * Verified on a device: without this the installer activity never starts and the
 * requested-permission list holds INTERNET and nothing else.
 */
export function patchAndroidManifest(content: string): Patch {
  if (content.includes(INSTALL_PERMISSION)) {
    return unchanged("already allows installing an APK");
  }

  const line = `    <uses-permission android:name="${INSTALL_PERMISSION}" />`;

  // Beside the permissions that are already there, so the file keeps its shape.
  const existing = /^[ 	]*<uses-permission[^>]*\/>\s*$/m.exec(content);
  if (existing) {
    const at = existing.index + existing[0].length;
    return {
      content: `${content.slice(0, at)}\n${line}${content.slice(at)}`,
      summary: "added REQUEST_INSTALL_PACKAGES",
    };
  }

  const close = content.lastIndexOf("</manifest>");
  if (close === -1) {
    return {
      content: null,
      summary: "no </manifest> to insert into",
      manual: line,
    };
  }

  return {
    content: `${content.slice(0, close)}${line}\n${content.slice(close)}`,
    summary: "added REQUEST_INSTALL_PACKAGES",
  };
}

const CONFIG_IMPORT = 'import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";';

const CONFIG_BLOCK = (indent: string) =>
  [
    `${indent}CapacitorUpdater: capuchooUpdaterConfig({`,
    `${indent}  apiUrl: process.env.VITE_UPDATE_API_URL,`,
    `${indent}  channel: process.env.VITE_UPDATE_CHANNEL,`,
    `${indent}}),`,
  ].join("\n");

/**
 * Builds the plugin block with the helper instead of by hand.
 *
 * The helper fails the build on a missing update URL. A hand-written block does
 * not: the plugin accepts an empty `updateUrl` and then never checks for
 * updates, which is the worst available outcome because nothing reports it.
 *
 * Refuses rather than guesses in two cases - no `plugins` key to insert into, and
 * a `CapacitorUpdater` entry that is already there and hand-written. Both need a
 * judgement about the surrounding code that this cannot make.
 */
export function patchCapacitorConfig(content: string): Patch {
  if (content.includes("capuchooUpdaterConfig")) return unchanged("already uses the helper");

  const manual = [CONFIG_IMPORT, "", "plugins: {", CONFIG_BLOCK("  "), "},"].join("\n");

  if (/CapacitorUpdater\s*:/.test(content)) {
    return {
      content: null,
      summary: "hand-written CapacitorUpdater block left alone",
      manual,
    };
  }

  const plugins = /^(\s*)plugins\s*:\s*\{/m.exec(content);
  if (!plugins) {
    return { content: null, summary: "no plugins block to insert into", manual };
  }

  const openingEnd = plugins.index + plugins[0].length;
  const entryIndent = `${indentOf(plugins[0])}  `;

  const withEntry =
    content.slice(0, openingEnd) + "\n" + CONFIG_BLOCK(entryIndent) + content.slice(openingEnd);

  return {
    content: `${CONFIG_IMPORT}\n${withEntry}`,
    summary: "added the CapacitorUpdater block",
  };
}

/** A unified-ish diff, enough to see what a step is about to do. */
export function describePatch(file: string, before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  const added = afterLines.filter((line) => !beforeLines.includes(line) && line.trim() !== "");

  return [`${file}`, ...added.map((line) => `  + ${line}`)].join("\n");
}
