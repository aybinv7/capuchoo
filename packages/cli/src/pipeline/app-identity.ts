/** Where a detected value came from, so a prompt can say why it is suggesting it. */
export interface Detected {
  value: string;
  source: string;
}

export interface AppIdentity {
  appId?: Detected;
  appName?: Detected;
}

export interface ProjectFiles {
  /** `capacitor.config.ts` / `.js` / `.json`. */
  capacitorConfig?: string | undefined;
  /** `android/app/build.gradle`. */
  buildGradle?: string | undefined;
  /** The production flavour's env file. */
  envFile?: string | undefined;
  packageJson?: string | undefined;
}

/**
 * A string literal for `key`, including the fallback in
 * `key: process.env.X ?? "literal"`.
 */
function literalFor(source: string, key: string): string | null {
  const line = new RegExp(`\\b${key}\\s*:\\s*([^,\\n]+)`).exec(source);
  if (!line) return null;

  // The last quoted string on the line: for a `??` chain that is the fallback,
  // and for a plain assignment it is the value itself.
  const quoted = [...line[1]!.matchAll(/["'`]([^"'`]+)["'`]/g)];
  return quoted.length > 0 ? quoted[quoted.length - 1]![1]! : null;
}

function envValue(source: string, key: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`).exec(line);
    if (match) {
      const value = match[1]!.trim().replace(/^(['"])(.*)\1$/, "$2");
      if (value) return value;
    }
  }
  return null;
}

const BUNDLE_ID = /^[a-z][\w]*(\.[a-z][\w]*)+$/i;

/**
 * The bundle identifier and name this project already declares.
 *
 * Order is by authority: `applicationId` in Gradle is what actually ships in the
 * APK and what a device reports, so it wins over the Capacitor config, which
 * wins over an env file that only affects a build.
 */
export function detectIdentity(files: ProjectFiles): AppIdentity {
  const identity: AppIdentity = {};

  const idCandidates: Detected[] = [];

  if (files.buildGradle) {
    const match = /\bapplicationId\s+["']([^"']+)["']/.exec(files.buildGradle);
    if (match) idCandidates.push({ value: match[1]!, source: "android/app/build.gradle" });
  }

  if (files.capacitorConfig) {
    const value = literalFor(files.capacitorConfig, "appId");
    if (value) idCandidates.push({ value, source: "capacitor.config" });
  }

  if (files.envFile) {
    const value = envValue(files.envFile, "VITE_APP_ID");
    if (value) idCandidates.push({ value, source: "the production env file" });
  }

  const appId = idCandidates.find((candidate) => BUNDLE_ID.test(candidate.value));
  if (appId) identity.appId = appId;

  const nameCandidates: Detected[] = [];

  if (files.capacitorConfig) {
    const value = literalFor(files.capacitorConfig, "appName");
    if (value) nameCandidates.push({ value, source: "capacitor.config" });
  }

  if (files.envFile) {
    const value = envValue(files.envFile, "VITE_APP_NAME");
    if (value) nameCandidates.push({ value, source: "the production env file" });
  }

  if (files.packageJson) {
    try {
      const parsed = JSON.parse(files.packageJson) as { name?: string };
      if (parsed.name) nameCandidates.push({ value: parsed.name, source: "package.json" });
    } catch {
      // A malformed package.json is not this function's problem.
    }
  }

  const appName = nameCandidates[0];
  if (appName) identity.appName = appName;

  return identity;
}

/**
 * Bundle ids found in the project that disagree with the chosen one.
 *
 * The device reports whatever is compiled into the binary, so a Gradle
 * `applicationId` that differs from the linked app is a mismatch the server
 * answers with "App not found" - and only on a device.
 */
export function conflictingIds(files: ProjectFiles, chosen: string): Detected[] {
  const found: Detected[] = [];

  if (files.buildGradle) {
    const match = /\bapplicationId\s+["']([^"']+)["']/.exec(files.buildGradle);
    if (match && match[1] !== chosen) {
      found.push({ value: match[1]!, source: "android/app/build.gradle" });
    }
  }

  if (files.capacitorConfig) {
    const value = literalFor(files.capacitorConfig, "appId");
    if (value && value !== chosen) found.push({ value, source: "capacitor.config" });
  }

  if (files.envFile) {
    const value = envValue(files.envFile, "VITE_APP_ID");
    if (value && value !== chosen) found.push({ value, source: "the production env file" });
  }

  return found;
}
