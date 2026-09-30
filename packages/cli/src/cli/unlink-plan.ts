/**
 * The inverse of what `init` writes into a flavour env file: the two variables that point a build
 * at a server and a channel, and the comment `init` puts above them. Every other line stays,
 * including the app's own VITE_UPDATE_* tuning, because those are the app's settings and not a
 * link to any server.
 */

const LINK_KEYS = ["VITE_UPDATE_API_URL", "VITE_UPDATE_CHANNEL"] as const;

const INIT_COMMENT = [
  "# Capuchoo. Both are required: capuchooUpdaterConfig() refuses to build a",
  "# plugin block without them, and an empty updateUrl disables updates silently.",
];

export interface EnvUnlink {
  /** The file with the link removed, or null when there was nothing to remove. */
  content: string | null;
  removed: string[];
}

const isLinkLine = (line: string) =>
  LINK_KEYS.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(line));

export function stripUpdateLink(content: string): EnvUnlink {
  const lines = content.split(/\r?\n/);
  const removed = lines.filter(isLinkLine).map((line) => line.split("=")[0]!.trim());
  if (removed.length === 0) return { content: null, removed: [] };

  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (isLinkLine(line)) continue;
    const startsComment =
      line === INIT_COMMENT[0] &&
      lines[index + 1] === INIT_COMMENT[1] &&
      lines.slice(index + 2).some(isLinkLine);
    if (startsComment) {
      index += 1;
      continue;
    }
    kept.push(line);
  }

  const collapsed = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*$/, "\n");
  return { content: collapsed, removed };
}

export interface UnlinkOptions {
  deleteApp: boolean;
  signOut: boolean;
  forgetSigningKey: boolean;
}

export interface UnlinkFacts {
  linked: boolean;
  appLabel: string | null;
  envFilesWithLink: readonly string[];
  hasSigningKey: boolean;
  signedIn: boolean;
}

export interface UnlinkAction {
  id: "delete-app" | "env" | "project" | "signing-key" | "sign-out";
  description: string;
  /** Cannot be undone from this machine. */
  destructive: boolean;
}

/**
 * What `unlink` will do, in the order it does it. The server app goes first: if deleting it fails,
 * nothing local has changed yet and the command can simply be run again.
 */
export function planUnlink(facts: UnlinkFacts, options: UnlinkOptions): UnlinkAction[] {
  const actions: UnlinkAction[] = [];
  if (options.deleteApp && facts.linked && facts.appLabel)
    actions.push({
      id: "delete-app",
      description: `Delete ${facts.appLabel} on the server, with its channels, releases and devices`,
      destructive: true,
    });
  for (const file of facts.envFilesWithLink)
    actions.push({
      id: "env",
      description: `Remove VITE_UPDATE_API_URL and VITE_UPDATE_CHANNEL from ${file}`,
      destructive: false,
    });
  if (facts.linked)
    actions.push({
      id: "project",
      description: "Remove .capuchoo/project.json",
      destructive: false,
    });
  if (options.forgetSigningKey && facts.hasSigningKey)
    actions.push({
      id: "signing-key",
      description:
        "Delete .capuchoo/signing-key.pem. Builds already installed trust only this key and will refuse releases signed by a new one",
      destructive: true,
    });
  if (options.signOut && facts.signedIn)
    actions.push({
      id: "sign-out",
      description: "Forget the stored API key and server address on this machine",
      destructive: false,
    });
  return actions;
}
