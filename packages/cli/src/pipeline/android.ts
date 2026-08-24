import fs from "node:fs";
import path from "node:path";
import { run, type RunOptions } from "../utils/exec.js";
import { assembleTask, parseProductFlavors } from "./gradle-variant.js";

/**
 * Android compilation and artefact discovery.
 *
 * The important addition here is the signature check. `assembleRelease` on a
 * project with no `signingConfig` succeeds and writes
 * `app-release-unsigned.apk`. The old `findApk` accepted any `.apk` in the
 * variant directory, so the CLI happily uploaded an unsigned APK as a release -
 * and Android refuses to install it. The failure only showed up on a user's
 * phone, days later.
 */

export type BuildType = "debug" | "release";

export interface AndroidBuildResult {
  apkPath: string;
  signed: boolean;
  byteSize: number;
}

function gradleWrapper(androidDir: string): string {
  const name = process.platform === "win32" ? "gradlew.bat" : "gradlew";
  const wrapper = path.join(androidDir, name);

  if (!fs.existsSync(wrapper)) {
    throw new Error(`No Gradle wrapper at ${wrapper}. Run "cap add android" in the app first.`);
  }

  // Gradle's wrapper must be executable; a fresh git clone on Unix sometimes
  // loses the bit.
  if (process.platform !== "win32") {
    try {
      fs.accessSync(wrapper, fs.constants.X_OK);
    } catch {
      fs.chmodSync(wrapper, 0o755);
    }
  }

  return process.platform === "win32" ? wrapper : `./${name}`;
}

/** Product flavours declared by app/build.gradle, or none. */
export function readProductFlavors(androidDir: string): string[] {
  for (const name of ["build.gradle", "build.gradle.kts"]) {
    const file = path.join(androidDir, "app", name);
    if (fs.existsSync(file)) return parseProductFlavors(fs.readFileSync(file, "utf8"));
  }
  return [];
}

export async function assembleAndroid(
  androidDir: string,
  buildType: BuildType,
  options: Omit<RunOptions, "cwd">,
  flavor?: string,
): Promise<void> {
  // With flavours, `assembleDebug` builds every one of them and writes each to
  // its own directory - slow, and it leaves the pipeline guessing which APK it
  // meant. Naming the variant builds exactly one.
  const task = assembleTask(buildType, flavor);

  await run(gradleWrapper(androidDir), [task], {
    ...options,
    cwd: androidDir,
    // Gradle on a cold cache legitimately takes a long time; 30 minutes is
    // generous rather than a hang.
    timeoutMs: 30 * 60 * 1000,
  });
}

/**
 * Finds the APK produced for a variant.
 *
 * Two layouts: `outputs/apk/<buildType>/` without flavours, and
 * `outputs/apk/<flavour>/<buildType>/` with them. Looking only in the first is
 * how a successful flavoured build reported "no debug APK exists".
 */
export function findApk(androidDir: string, buildType: BuildType, flavor?: string): string | null {
  const apkRoot = path.join(androidDir, "app", "build", "outputs", "apk");

  const candidates = [
    ...(flavor ? [path.join(apkRoot, flavor, buildType)] : []),
    path.join(apkRoot, buildType),
  ];

  const variantDir = candidates.find((dir) => fs.existsSync(dir));
  if (!variantDir) return null;

  const found: { file: string; mtime: number }[] = [];

  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(absolute);
      } else if (item.name.endsWith(".apk") && !item.name.includes("androidTest")) {
        found.push({ file: absolute, mtime: fs.statSync(absolute).mtimeMs });
      }
    }
  };

  walk(variantDir);
  if (found.length === 0) return null;

  // Newest wins - a stale APK from a previous variant can linger here.
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0]!.file;
}

/**
 * Reports whether an APK carries a signature block.
 *
 * An APK is a zip; a signed one contains either a v1 signature
 * (`META-INF/*.RSA|DSA|EC`) or a v2/v3 "APK Sig Block 42" magic before the
 * central directory. Checking both covers modern and legacy signing without
 * needing apksigner on PATH.
 */
export function isApkSigned(apkPath: string): boolean {
  const contents = fs.readFileSync(apkPath);

  // v2/v3: the APK Signing Block sits just before the central directory and is
  // terminated by this 16-byte magic.
  if (contents.includes(Buffer.from("APK Sig Block 42", "latin1"))) return true;

  // v1: JAR signing puts the certificate in META-INF. Entry names appear in the
  // central directory as plain text, so a substring scan is sufficient.
  const text = contents.toString("latin1");
  return /META-INF\/[^/]+\.(RSA|DSA|EC)/.test(text);
}

/**
 * Locates the build artefact and refuses an unsigned release.
 *
 * `allowUnsigned` exists for the case where signing happens later in a separate
 * pipeline stage, but it has to be asked for explicitly.
 */
export function collectAndroidArtifact(
  androidDir: string,
  buildType: BuildType,
  allowUnsigned: boolean,
  flavor?: string,
): AndroidBuildResult {
  const apkPath = findApk(androidDir, buildType, flavor);

  if (!apkPath) {
    const looked = flavor
      ? `${path.join(androidDir, "app/build/outputs/apk", flavor, buildType)} or `
      : "";
    throw new Error(
      `Gradle reported success but no ${buildType} APK exists under ` +
        `${looked}${path.join(androidDir, "app/build/outputs/apk", buildType)}.`,
    );
  }

  const signed = isApkSigned(apkPath);

  if (buildType === "release" && !signed && !allowUnsigned) {
    throw new Error(
      `${path.basename(apkPath)} is not signed, so Android will refuse to install it.\n` +
        "  Add a release signingConfig to android/app/build.gradle and provide the\n" +
        "  keystore, build with --type debug, or pass --allow-unsigned if this\n" +
        "  artefact is signed later in your pipeline.",
    );
  }

  return { apkPath, signed, byteSize: fs.statSync(apkPath).size };
}
