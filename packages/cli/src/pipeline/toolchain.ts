import fs from "node:fs";
import path from "node:path";

/**
 * Locates the tools the deploy pipeline needs.
 *
 * The old pipeline assumed a great deal: that pnpm was the package manager,
 * that the application defined scripts called `assets:<env>`, `build:<env>` and
 * `trapeze:<env>`, and that `@capgo/cli` could be fetched from the network
 * mid-deploy. Any of those being false failed the deploy halfway through, after
 * the version had already been bumped.
 *
 * Nothing here shells out to a package manager to find a tool. A dependency's
 * executable already lives in `node_modules/.bin`, and in a workspace it lives
 * in the *root* `node_modules/.bin` too - so walking up from the app directory
 * finds it whether the app is standalone or a workspace member.
 */

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export interface Toolchain {
  /** Directory the application lives in. */
  appDir: string;
  /** Workspace root, or `appDir` when the app is standalone. */
  workspaceRoot: string;
  packageManager: PackageManager;
  /** True when Vite+ drives this workspace. */
  hasVitePlus: boolean;
}

const BIN_DIR = path.join("node_modules", ".bin");

/** Directories that could hold a dependency executable, nearest first. */
function binDirs(from: string): string[] {
  const dirs: string[] = [];
  let current = path.resolve(from);

  for (;;) {
    dirs.push(path.join(current, BIN_DIR));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return dirs;
}

/**
 * Resolves a dependency executable to an absolute path.
 *
 * On Windows the runnable file is `<name>.cmd` (or `.exe`), not `<name>`, so
 * both are probed. Returns null when the tool is not installed - callers decide
 * whether that is fatal or a reason to skip a step.
 */
export function resolveBin(name: string, from: string): string | null {
  const candidates = process.platform === "win32" ? [`${name}.cmd`, `${name}.exe`, name] : [name];

  for (const dir of binDirs(from)) {
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      if (fs.existsSync(full)) return full;
    }
  }

  return null;
}

/** Finds the nearest ancestor containing any of `markers`. */
function findUp(from: string, markers: string[]): string | null {
  let current = path.resolve(from);

  for (;;) {
    if (markers.some((marker) => fs.existsSync(path.join(current, marker)))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Detects the workspace root and package manager.
 *
 * Lockfile detection is deliberately last: a `packageManager` field is an
 * explicit declaration, a lockfile is an artefact. When nothing is declared the
 * fallback is npm, which every Node installation has.
 */
export function detectToolchain(appDir: string): Toolchain {
  const workspaceRoot =
    findUp(appDir, [
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
    ]) ?? appDir;

  let packageManager: PackageManager = "npm";

  const declared = readPackageManagerField(workspaceRoot);
  if (declared) {
    packageManager = declared;
  } else if (
    fs.existsSync(path.join(workspaceRoot, "pnpm-lock.yaml")) ||
    fs.existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"))
  ) {
    packageManager = "pnpm";
  } else if (fs.existsSync(path.join(workspaceRoot, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (
    fs.existsSync(path.join(workspaceRoot, "bun.lock")) ||
    fs.existsSync(path.join(workspaceRoot, "bun.lockb"))
  ) {
    packageManager = "bun";
  }

  return {
    appDir,
    workspaceRoot,
    packageManager,
    hasVitePlus: resolveBin("vp", appDir) !== null,
  };
}

function readPackageManagerField(root: string): PackageManager | null {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      packageManager?: string;
      devEngines?: { packageManager?: { name?: string } | Array<{ name?: string }> };
    };

    const fromField = pkg.packageManager?.split("@")[0];
    if (isPackageManager(fromField)) return fromField;

    const declared = pkg.devEngines?.packageManager;
    const name = Array.isArray(declared) ? declared[0]?.name : declared?.name;
    if (isPackageManager(name)) return name;
  } catch {
    // A malformed package.json is the app's problem, not a reason to crash
    // during tool detection.
  }

  return null;
}

function isPackageManager(value: string | undefined): value is PackageManager {
  return value === "pnpm" || value === "npm" || value === "yarn" || value === "bun";
}

/** Reads a script out of the application's package.json. */
export function readScript(appDir: string, name: string): string | null {
  const file = path.join(appDir, "package.json");
  if (!fs.existsSync(file)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts?.[name] ?? null;
  } catch {
    return null;
  }
}

/** The argv for running a package.json script with the detected manager. */
export function scriptCommand(
  toolchain: Toolchain,
  script: string,
): { file: string; args: string[] } {
  return { file: toolchain.packageManager, args: ["run", script] };
}

export interface ToolLookup {
  /** Absolute path to the executable, when it is installed. */
  bin: string | null;
  /** Package that provides it, for the "not installed" message. */
  packageName: string;
}

/**
 * Tools the pipeline can use. Every one of them is optional: a missing tool
 * makes the CLI skip or substitute that step, never abort the deploy.
 */
export function lookupTools(appDir: string) {
  return {
    vite: { bin: resolveBin("vite", appDir), packageName: "vite" },
    vp: { bin: resolveBin("vp", appDir), packageName: "vite-plus" },
    capacitor: { bin: resolveBin("cap", appDir), packageName: "@capacitor/cli" },
    assets: {
      bin: resolveBin("capacitor-assets", appDir),
      packageName: "@capacitor/assets",
    },
    trapeze: {
      bin: resolveBin("trapeze", appDir),
      packageName: "@trapezedev/configure",
    },
  } satisfies Record<string, ToolLookup>;
}
