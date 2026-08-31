/**
 * Which plugin versions belong in an app, decided by the Capacitor major it is
 * already on.
 *
 * `setup` used to install every package bare, which resolves to `latest`. In a
 * Capacitor 7 app that pulls Capacitor 8 plugins: `@capgo/capacitor-updater@8`
 * declares `@capacitor/core: ^8.0.0`, so the install either fails on peers or -
 * worse - succeeds and puts native code built against Capacitor 8 into a
 * Capacitor 7 Gradle project. Nothing about that failure names the real cause.
 *
 * The runtime itself is version-agnostic: `@capuchoo/updater` uses only
 * `Capacitor` and the `PluginListenerHandle` type, both unchanged across 6, 7
 * and 8. So this is packaging, not capability.
 */

/**
 * The `@capuchoo/updater` line this CLI installs.
 *
 * Explicit, and not the CLI's own version: the two are versioned independently,
 * so `^${cliVersion}` asks for a runtime release that may not exist. Bump this
 * when the updater is released - `runtimeRange` in the tests pins the shape.
 *
 * It must also not be left bare. A bare name resolves to whatever the package
 * manager believes `latest` is, and pnpm caches registry metadata - so minutes
 * after a release it installs the previous version and says nothing.
 */
export const RUNTIME_VERSION = "0.10.0";

/** Capacitor majors this toolchain installs for. */
export const SUPPORTED_MAJORS = [7, 8] as const;

export type CapacitorMajor = (typeof SUPPORTED_MAJORS)[number];

export interface PackageSpec {
  name: string;
  /** Version range to install, or null to take the registry's latest. */
  range: string | null;
  why: string;
}

/**
 * Reads the Capacitor major from a dependency range like `^7.4.4`.
 *
 * Deliberately tolerant of `~`, `>=`, `workspace:` and a bare version, and
 * deliberately not a semver parser: only the major matters here.
 */
export function majorFromRange(range: string | undefined): number | null {
  if (!range) return null;
  const match = /(\d+)\s*\./.exec(range.replace(/^[^\d]*/, "$&"));
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

export interface CapacitorDetection {
  major: number | null;
  /** Where the answer came from, for the message when it is unsupported. */
  source: "dependencies" | "devDependencies" | null;
}

export function detectCapacitor(manifest: {
  dependencies?: Record<string, string> | undefined;
  devDependencies?: Record<string, string> | undefined;
}): CapacitorDetection {
  const fromDeps = manifest.dependencies?.["@capacitor/core"];
  if (fromDeps) return { major: majorFromRange(fromDeps), source: "dependencies" };

  const fromDev = manifest.devDependencies?.["@capacitor/core"];
  if (fromDev) return { major: majorFromRange(fromDev), source: "devDependencies" };

  return { major: null, source: null };
}

export function isSupportedMajor(major: number | null): major is CapacitorMajor {
  return major !== null && (SUPPORTED_MAJORS as readonly number[]).includes(major);
}

/**
 * The packages an app needs, pinned to the line that matches its Capacitor.
 *
 * `@capacitor/file-transfer` is the one that does not follow Capacitor's own
 * numbering: its 1.x line peers `>=7.0.0` and 2.x requires `>=8.0.0`.
 */
export function runtimePackages(major: CapacitorMajor): PackageSpec[] {
  return [
    {
      name: "@capuchoo/updater",
      range: `^${RUNTIME_VERSION}`,
      why: "the update runtime",
    },
    {
      name: "@capgo/capacitor-updater",
      range: `^${major}`,
      why: "the native plugin it drives",
    },
    {
      name: "@capacitor/app",
      range: `^${major}`,
      why: "reads the installed version and build number",
    },
  ];
}

export function telemetryPackages(major: CapacitorMajor): PackageSpec[] {
  return [
    {
      name: "@capacitor/device",
      range: `^${major}`,
      why: "reports OS version and emulator flag",
    },
  ];
}

/** Only needed to download and install an APK from inside the app. */
export function nativePackages(major: CapacitorMajor): PackageSpec[] {
  return [
    {
      name: "@capacitor/file-transfer",
      range: major >= 8 ? "^2" : "^1",
      why: "downloads the APK",
    },
    { name: "@capacitor/filesystem", range: `^${major}`, why: "caches it" },
    { name: "@capacitor/network", range: `^${major}`, why: "checks connectivity first" },
    {
      name: "@capacitor/local-notifications",
      range: `^${major}`,
      // Installed with the rest, used only when VITE_UPDATE_NOTIFY=true. A
      // backgrounded download is invisible otherwise, and an update that looks
      // stalled is one people cancel.
      why: "shows download progress while the app is in the background",
    },
    {
      name: "@capawesome-team/capacitor-file-opener",
      range: `^${major}`,
      why: "hands it to the installer",
    },
  ];
}

/** `name@range`, or bare `name` when any version will do. */
export function installSpec(pkg: PackageSpec): string {
  return pkg.range ? `${pkg.name}@${pkg.range}` : pkg.name;
}
