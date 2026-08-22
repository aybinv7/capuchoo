/**
 * Runtime configuration for the updater.
 *
 * Values come from the build's `VITE_*` variables, which the CLI injects from
 * the flavour's env file. `configureUpdater` lets an app override any of them
 * at startup - useful for tests and for apps that resolve their endpoint from
 * a login response rather than at build time.
 */
export interface UpdaterConfig {
  /** Base URL of the Capuchoo backend, with no trailing slash. */
  apiUrl: string;
  /** Bundle identifier of this build. Must match what the CLI published. */
  appId: string;
  /** Human-readable name, used in prompts and in the APK cache file name. */
  appName: string;
  /** Channel to consult. Bound to an environment server-side. */
  channel: string;
  /** Free-form: an app may use flavours beyond dev/staging/prod. */
  environment: string;
  /** Milliseconds before an update check is abandoned. */
  timeoutMs: number;
}

function env(key: string): string | undefined {
  // `import.meta.env` is replaced at build time by Vite. Guard the access so
  // the module can also be imported from Node (tests, SSR) without throwing.
  const source = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return source?.[key];
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

let overrides: Partial<UpdaterConfig> = {};

/**
 * Overrides configuration resolved from the build. Call before `init`.
 * Passing `{}` clears previous overrides.
 */
export function configureUpdater(next: Partial<UpdaterConfig>): void {
  overrides = { ...overrides, ...next };
}

/** @internal exposed for tests. */
export function resetUpdaterConfig(): void {
  overrides = {};
}

export function getUpdaterConfig(): UpdaterConfig {
  const apiUrl = overrides.apiUrl ?? env("VITE_UPDATE_API_URL") ?? "";

  return {
    apiUrl: stripTrailingSlash(apiUrl),
    appId: overrides.appId ?? env("VITE_APP_ID") ?? "",
    appName: overrides.appName ?? env("VITE_APP_NAME") ?? "the app",
    channel: overrides.channel ?? env("VITE_UPDATE_CHANNEL") ?? "prod",
    environment:
      overrides.environment ?? env("VITE_ENVIRONMENT") ?? (env("PROD") === "true" ? "prod" : "dev"),
    timeoutMs: overrides.timeoutMs ?? 30_000,
  };
}

/**
 * Reasons the updater cannot run, as user-facing strings.
 *
 * The previous implementation defaulted `apiUrl` to a hard-coded Render URL and
 * `appId` to a hard-coded bundle id. A build with a missing variable therefore
 * silently pointed at somebody else's backend, or asked for the wrong app, and
 * reported "you are up to date". Failing loudly is the whole point of this
 * function.
 */
export function describeConfigProblems(config: UpdaterConfig): string[] {
  const problems: string[] = [];
  if (!config.apiUrl) {
    problems.push("VITE_UPDATE_API_URL is not set, so updates cannot be checked");
  }
  if (!config.appId) {
    problems.push("VITE_APP_ID is not set, so the server cannot identify this build");
  }
  return problems;
}
