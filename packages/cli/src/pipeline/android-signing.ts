/**
 * Whether this project can actually produce a signed release APK.
 *
 * A `deploy native` to a prod channel spent 1m51s compiling and then failed at
 * `:app:packageProdRelease` with
 *
 *     A failure occurred while executing PackageAndroidArtifact$IncrementalSplitterRunnable
 *
 * which names neither signing nor the missing values. The cause was an empty
 * `signingConfigs.release`: the build file reads `RELEASE_STORE_FILE` and three
 * siblings out of `local.properties`, and none of them were set on that machine.
 * `doctor` had reported everything green beforehand, because it never looked.
 *
 * Pure over the two files' contents, so the rule is testable without an Android
 * SDK, a keystore, or two minutes of Gradle.
 */

/** The balanced body of `name { ... }`, or null when there is no such block. */
function blockBody(source: string, name: string): string | null {
  const start = source.search(new RegExp(`\\b${name}\\s*\\{`));
  if (start === -1) return null;

  const open = source.indexOf("{", start);
  let depth = 0;

  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }

  return null;
}

export type SigningStatus =
  /** The release build type signs with nothing, so Gradle emits an unsigned APK. */
  | { kind: "unsigned" }
  /** A signing config is wired up, but the values it reads are absent. */
  | { kind: "unconfigured"; configName: string; missing: string[] }
  /** Every property the signing config reads is present. */
  | { kind: "ready"; configName: string; storeFile: string | null };

export function inspectReleaseSigning(input: {
  buildGradle: string;
  /** Contents of `android/local.properties`, or "" when the file is absent. */
  localProperties: string;
}): SigningStatus {
  const buildTypes = blockBody(input.buildGradle, "buildTypes") ?? "";
  const release = blockBody(buildTypes, "release") ?? "";

  const wired = /signingConfig\s+signingConfigs\.(\w+)/.exec(release);
  if (!wired) return { kind: "unsigned" };

  const configName = wired[1]!;
  const configs = blockBody(input.buildGradle, "signingConfigs") ?? "";
  const config = blockBody(configs, configName) ?? "";

  // Whatever the build file actually reads, rather than a hard-coded list of
  // names - a project is free to call them anything.
  const needed = [...config.matchAll(/getProperty\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1]!,
  );

  const present = new Map<string, string>();
  for (const line of input.localProperties.split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const match = /^\s*([\w.]+)\s*=\s*(.*)$/.exec(line);
    if (match) present.set(match[1]!, match[2]!.trim());
  }

  const missing = [...new Set(needed)].filter((key) => !present.get(key));

  if (missing.length > 0) return { kind: "unconfigured", configName, missing };

  // The store path is reported so the caller can check the file exists - a path
  // that points at nothing fails the same way as a missing property.
  const storeKey = needed.find((key) => /STORE_FILE|KEYSTORE/i.test(key));

  return {
    kind: "ready",
    configName,
    storeFile: storeKey ? (present.get(storeKey) ?? null) : null,
  };
}

/** One line naming what to do about it. */
export function describeSigning(status: SigningStatus): string {
  switch (status.kind) {
    case "unsigned":
      return (
        "The release build type declares no signingConfig, so Gradle will emit an " +
        "unsigned APK and Android will refuse to install it."
      );
    case "unconfigured":
      return (
        `signingConfigs.${status.configName} reads ` +
        `${status.missing.join(", ")} from android/local.properties, and ` +
        `${status.missing.length === 1 ? "it is" : "they are"} not set. The build ` +
        "reaches the packaging task and fails there, after compiling everything."
      );
    case "ready":
      return `signingConfigs.${status.configName}`;
  }
}
