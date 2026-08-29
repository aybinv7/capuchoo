import fs from "node:fs";
import path from "node:path";
import { run, type RunOptions } from "../utils/exec.js";
import type { ResolvedFlavour } from "./flavour.js";
import { resolveBin } from "./toolchain.js";

/**
 * Applies a flavour's identity and version to the native projects.
 *
 * The old pipeline ran `pnpm trapeze:<env>` and died if that script did not
 * exist or Trapeze was not installed - which is the single most common way a
 * deploy failed on a fresh checkout. Here Trapeze is *preferred* but optional:
 *
 *  1. Trapeze installed and a config exists for the flavour -> run Trapeze, so
 *     the app's own YAML stays authoritative (permissions, plist entries, and
 *     everything else this file does not model).
 *  2. Otherwise -> apply the identity and version directly. That is the subset
 *     every flavour needs, and it is enough for a correct build.
 *
 * Either way the deploy proceeds, and the CLI says which path it took.
 */

export type NativeConfigMethod = "trapeze" | "builtin";

export interface NativeConfigResult {
  method: NativeConfigMethod;
  /** Files the built-in path rewrote. Empty when Trapeze ran. */
  changed: string[];
  /** Why the built-in path was used, when it was. */
  reason?: string;
  /** False when Trapeze ran but changed nothing it was asked to. */
  applied?: boolean;
  /** Set when the run succeeded without doing what the config asked. */
  warning?: string;
}

export interface NativeConfigInput {
  appDir: string;
  androidDir: string;
  iosDir: string;
  flavour: ResolvedFlavour;
  /** Environment for Trapeze's `vars:` block and for the built-in patcher. */
  env: Record<string, string>;
  platform: "android" | "ios";
  runOptions: Omit<RunOptions, "cwd" | "env">;
}

export async function applyNativeConfig(input: NativeConfigInput): Promise<NativeConfigResult> {
  const trapezeBin = resolveBin("trapeze", input.appDir);

  if (trapezeBin && input.flavour.trapezeConfig) {
    // Identity first, then Trapeze on top. These used to be alternatives, and
    // that was wrong in a way nothing reported: the built-in step is what writes
    // applicationId, versionName and versionCode into build.gradle, so a Trapeze
    // config that only declared a permission meant the version was never applied
    // at all. The APK then shipped with whatever gradle happened to hold - a
    // release published as v0.3.0 / code 5 containing 0.2.1 / code 4.
    //
    // Which does not merely mislabel the file. The device reports the version
    // compiled into it, so it would install that update and go on reporting the
    // older code, be offered the same release again, and loop.
    //
    // Trapeze runs second so an app that *does* declare versions in its config
    // still wins - it is the more specific statement of intent.
    const builtin = applyBuiltinConfig(input);

    // `-y` accepts the diff Trapeze prints; without it the command waits for
    // input forever in CI.
    const result = await run(trapezeBin, ["run", input.flavour.trapezeConfig, "-y"], {
      ...input.runOptions,
      cwd: input.appDir,
      env: input.env,
    });

    return { method: "trapeze", changed: builtin.changed, ...describeTrapezeRun(result) };
  }

  const reason = !trapezeBin
    ? "@trapezedev/configure is not installed"
    : `no Trapeze config at ${input.flavour.config.trapezeConfig}`;

  return { ...applyBuiltinConfig(input), reason };
}

/**
 * What Trapeze actually did, rather than merely that it exited 0.
 *
 * Trapeze succeeds when it does nothing. A config whose shape it does not
 * recognise produces
 *
 *   [warn] Unsupported configuration option android.0. Skipping
 *   [info] No changes to apply
 *
 * and exit code 0 - so "Trapeze applied the flavour configuration" was printed
 * for a run that applied none of it. That cost a real debugging cycle: the
 * manifest permission an APK install needs was silently never added, and the
 * step said it had been. Exit codes are not evidence when a tool treats
 * "nothing matched" as success.
 */
export function describeTrapezeRun(result: { stdout: string; stderr: string }): {
  applied?: boolean;
  warning?: string;
} {
  const output = `${result.stdout}
${result.stderr}`;

  const unsupported = /Unsupported configuration option ([^\s.]+(?:\.[^\s.]+)*)\.?/.exec(output);
  if (unsupported) {
    return {
      applied: false,
      warning:
        `Trapeze ignored "${unsupported[1]}" in the flavour config - that key is not a shape ` +
        "it recognises, so those settings were not applied",
    };
  }

  if (/No changes to apply/i.test(output)) {
    return {
      applied: false,
      warning:
        "Trapeze ran and found nothing to change - the flavour config may not match the project",
    };
  }

  return { applied: true };
}

function applyBuiltinConfig(input: NativeConfigInput): Omit<NativeConfigResult, "reason"> {
  const changed: string[] = [];

  if (input.platform === "android") {
    changed.push(...patchAndroid(input));
  } else {
    changed.push(...patchIos(input));
  }

  return { method: "builtin", changed };
}

function readEnv(env: Record<string, string>, key: string): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

function patchAndroid(input: NativeConfigInput): string[] {
  const androidRoot = path.resolve(input.appDir, input.androidDir);
  if (!fs.existsSync(androidRoot)) return [];

  const appId = readEnv(input.env, "VITE_APP_ID");
  const appName = readEnv(input.env, "VITE_APP_NAME");
  const version = readEnv(input.env, "VITE_APP_VERSION");
  const versionCode = readEnv(input.env, "VERSION_CODE");
  const changed: string[] = [];

  const gradleFile = path.join(androidRoot, "app", "build.gradle");
  if (fs.existsSync(gradleFile)) {
    let gradle = fs.readFileSync(gradleFile, "utf8");
    const before = gradle;

    if (appId) {
      // Both forms appear in a Capacitor project: `namespace = "..."` and
      // `applicationId "..."`. Quote style varies, so match either.
      gradle = gradle.replace(/(\bnamespace\s*=\s*)["'][^"']*["']/, `$1"${appId}"`);
      gradle = gradle.replace(/(\bapplicationId\s*=?\s*)["'][^"']*["']/, `$1"${appId}"`);
    }
    if (version) {
      gradle = gradle.replace(/(\bversionName\s*=?\s*)["'][^"']*["']/, `$1"${version}"`);
    }
    if (versionCode) {
      gradle = gradle.replace(/(\bversionCode\s*=?\s*)\d+/, `$1${versionCode}`);
    }

    if (gradle !== before) {
      fs.writeFileSync(gradleFile, gradle);
      changed.push(path.relative(input.appDir, gradleFile));
    }
  }

  const stringsFile = path.join(androidRoot, "app", "src", "main", "res", "values", "strings.xml");
  if (fs.existsSync(stringsFile)) {
    let strings = fs.readFileSync(stringsFile, "utf8");
    const before = strings;

    if (appName) {
      strings = replaceStringResource(strings, "app_name", appName);
      strings = replaceStringResource(strings, "title_activity_main", appName);
    }
    if (appId) {
      strings = replaceStringResource(strings, "package_name", appId);
      strings = replaceStringResource(strings, "custom_url_scheme", appId);
    }

    if (strings !== before) {
      fs.writeFileSync(stringsFile, strings);
      changed.push(path.relative(input.appDir, stringsFile));
    }
  }

  return changed;
}

/** Replaces one `<string name="x">…</string>` value, escaping XML metacharacters. */
function replaceStringResource(xml: string, name: string, value: string): string {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const pattern = new RegExp(`(<string\\s+name=(?:"|')${name}(?:"|')\\s*>)([\\s\\S]*?)(</string>)`);
  return xml.replace(pattern, `$1${escaped}$3`);
}

function patchIos(input: NativeConfigInput): string[] {
  const iosRoot = path.resolve(input.appDir, input.iosDir);
  const plist = path.join(iosRoot, "App", "App", "Info.plist");
  if (!fs.existsSync(plist)) return [];

  const appName = readEnv(input.env, "VITE_APP_NAME");
  const version = readEnv(input.env, "VITE_APP_VERSION");
  const build = readEnv(input.env, "BUILD_NUMBER");

  let contents = fs.readFileSync(plist, "utf8");
  const before = contents;

  if (version) contents = replacePlistString(contents, "CFBundleShortVersionString", version);
  if (build) contents = replacePlistString(contents, "CFBundleVersion", build);
  if (appName) contents = replacePlistString(contents, "CFBundleDisplayName", appName);

  if (contents === before) return [];

  fs.writeFileSync(plist, contents);
  return [path.relative(input.appDir, plist)];
}

function replacePlistString(xml: string, key: string, value: string): string {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([\\s\\S]*?)(</string>)`);
  return xml.replace(pattern, `$1${value}$3`);
}

/**
 * The bundle identifier iOS builds from lives in `project.pbxproj`, which is
 * not safely editable with a regex. Trapeze does it properly, so the built-in
 * path reports the limitation instead of pretending to have handled it.
 */
export function builtinConfigLimitations(platform: "android" | "ios"): string[] {
  if (platform === "ios") {
    return ["the iOS bundle identifier in project.pbxproj is not changed without Trapeze"];
  }
  return ["AndroidManifest permissions declared only in a Trapeze config are not applied"];
}
