import type { Environment } from "./update-contract.js";

/**
 * `.capuchoo/project.json` - the file that makes an application deployable.
 *
 * Version 1 held only the cloud identifiers, so the CLI had to *guess* how to
 * build: it shelled out to `pnpm run assets:<env>`, `pnpm build:<env>`,
 * `pnpm trapeze:<env>` and `pnpm exec cap sync`. Any application that named
 * its scripts differently, used npm, or had not installed Trapeze simply
 * failed halfway through a deploy.
 *
 * Version 2 describes the *inputs* instead - where each flavour's env file,
 * Trapeze config and icon sources live - and lets the CLI own the execution.
 * Every field has a default, so a v1 file keeps working: `normaliseProjectConfig`
 * fills in the conventional layout both existing apps already use.
 */
export const PROJECT_CONFIG_VERSION = 2;

/** One build flavour, keyed by the environment its channels are bound to. */
export interface FlavourConfig {
  /**
   * Env file supplying `VITE_APP_ID`, `VITE_APP_NAME`, `VITE_UPDATE_CHANNEL`
   * and friends. The CLI reads it and passes the values to the build and to
   * the native configuration step as environment variables - it does not
   * rewrite the file, so a deploy leaves the working tree clean.
   */
  envFile: string;
  /** Trapeze config applied to the native projects. Optional. */
  trapezeConfig?: string;
  /** Directory holding `icon.png` / `splash.png` for icon generation. */
  assetPath?: string;
  /** Vite `--mode`. Defaults to the flavour name. */
  mode?: string;
}

export interface BuildConfig {
  /**
   * Overrides the web build. Leave unset and the CLI runs the project's own
   * Vite build through the workspace toolchain it detects.
   */
  command?: string;
  /** Where to run the build from, relative to the app. For monorepo roots. */
  cwd?: string;
}

export interface ProjectConfig {
  /** Absent on v1 files. */
  version?: number;

  /** Bundle identifier of the production flavour. */
  appId: string;
  /** Primary key of the application in Capuchoo. */
  cloudAppId: string;
  appName: string;
  createdAt: string;

  /** Vite output directory, and what Capacitor copies into the native app. */
  webDir?: string;
  androidDir?: string;
  iosDir?: string;

  /**
   * Monotonic native build numbers per environment. Written by the CLI, and
   * the one file a deploy is expected to modify.
   */
  versionCodeFile?: string;

  flavours?: Partial<Record<Environment, FlavourConfig>>;
  build?: BuildConfig;

  /** Optional GitHub Pages mirror for generated web assets. */
  ghPagesRepo?: string;

  /** @deprecated v1 fields, folded into `build` by `normaliseProjectConfig`. */
  monorepoRoot?: string;
  /** @deprecated v1 field. */
  packageName?: string;
}

/** A `ProjectConfig` with every optional resolved. */
export interface ResolvedProjectConfig {
  version: number;
  appId: string;
  cloudAppId: string;
  appName: string;
  createdAt: string;
  webDir: string;
  androidDir: string;
  iosDir: string;
  versionCodeFile: string;
  flavours: Record<Environment, FlavourConfig>;
  build: BuildConfig;
  ghPagesRepo?: string;
}

export const ENVIRONMENTS: readonly Environment[] = ["dev", "staging", "prod"];

/**
 * The layout both existing applications already use. Used as the default so a
 * v1 `project.json` needs no migration to keep deploying.
 */
export function defaultFlavour(environment: Environment): FlavourConfig {
  return {
    envFile: `build/${environment}/.env.${environment}`,
    trapezeConfig: `build/${environment}/trapeze.${environment}.yaml`,
    assetPath: `build/${environment}/assets`,
    mode: environment,
  };
}

export function normaliseProjectConfig(config: ProjectConfig): ResolvedProjectConfig {
  const flavours = {} as Record<Environment, FlavourConfig>;
  for (const environment of ENVIRONMENTS) {
    const defaults = defaultFlavour(environment);
    const declared = config.flavours?.[environment];
    flavours[environment] = {
      envFile: declared?.envFile ?? defaults.envFile,
      trapezeConfig: declared?.trapezeConfig ?? defaults.trapezeConfig,
      assetPath: declared?.assetPath ?? defaults.assetPath,
      mode: declared?.mode ?? defaults.mode,
    };
  }

  // v1 expressed monorepo builds as `monorepoRoot` + `packageName`, which the
  // CLI turned into `pnpm exec vp run <pkg>#build:<env>`. Carry that forward as
  // an explicit build command so the behaviour is visible rather than implied.
  const build: BuildConfig = { ...config.build };
  if (!build.cwd && config.monorepoRoot) build.cwd = config.monorepoRoot;
  if (!build.command && config.packageName) {
    build.command = `vp run ${config.packageName}#build`;
  }

  return {
    version: config.version ?? 1,
    appId: config.appId,
    cloudAppId: config.cloudAppId,
    appName: config.appName,
    createdAt: config.createdAt,
    webDir: config.webDir ?? "dist",
    androidDir: config.androidDir ?? "android",
    iosDir: config.iosDir ?? "ios",
    versionCodeFile: config.versionCodeFile ?? "version-code.json",
    flavours,
    build,
    ghPagesRepo: config.ghPagesRepo,
  };
}

/** Fields a `project.json` must carry for a deploy to be possible. */
export function validateProjectConfig(config: Partial<ProjectConfig> | null | undefined): string[] {
  if (!config) return ["project.json is missing or empty"];

  const problems: string[] = [];
  if (!config.appId) problems.push("appId is required");
  if (!config.cloudAppId) problems.push("cloudAppId is required");
  if (!config.appName) problems.push("appName is required");

  if (config.appId && !isValidBundleId(config.appId)) {
    problems.push(`appId "${config.appId}" is not a valid bundle identifier`);
  }

  return problems;
}

const BUNDLE_ID = /^[a-z][a-z\d_]*(\.[a-z][a-z\d_]*)+$/;

export function isValidBundleId(value: string): boolean {
  return BUNDLE_ID.test(value);
}

/**
 * Derives the environment a bundle identifier belongs to.
 *
 * The backend enforces the same rule server-side: a `.staging` build may only
 * be served staging channels. Mirroring it here lets the CLI refuse a
 * mismatched deploy before it uploads several megabytes.
 */
export function environmentFromAppId(appId: string): Environment {
  const id = appId.toLowerCase();
  if (id.endsWith(".staging")) return "staging";
  if (id.endsWith(".dev") || id.endsWith(".debug")) return "dev";
  return "prod";
}

/**
 * Whether a build may be served a channel bound to `channelEnvironment`.
 *
 * This mirrors the server's isolation check exactly, including its one
 * deliberate exception: a production build is allowed on a staging channel, so
 * a release candidate can be beta-tested by real installs without shipping a
 * separate bundle identifier.
 *
 * The rule lives here rather than being restated at each call site because the
 * CLI had reimplemented it as a plain equality check - which is *stricter* than
 * the server and rejected the exact beta-testing setup Lowmaro uses, where all
 * three channels are bound to staging and the app id carries no suffix.
 */
export function isEnvironmentAllowed(appId: string, channelEnvironment: Environment): boolean {
  const expected = environmentFromAppId(appId);
  if (expected === channelEnvironment) return true;
  return expected === "prod" && channelEnvironment === "staging";
}

/** Explains a rejected pairing, or null when it is allowed. */
export function describeEnvironmentMismatch(
  appId: string,
  channelEnvironment: Environment,
  channelName: string,
): string | null {
  if (isEnvironmentAllowed(appId, channelEnvironment)) return null;

  const expected = environmentFromAppId(appId);
  return (
    `Channel "${channelName}" serves the ${channelEnvironment} environment, but ` +
    `the build's VITE_APP_ID is "${appId}", which is a ${expected} bundle id. ` +
    "The server rejects this pairing, so the upload would be wasted."
  );
}
