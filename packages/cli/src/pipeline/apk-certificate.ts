import fs from "node:fs";
import path from "node:path";
import { run, type RunOptions } from "../utils/exec.js";

/** Where the certificate digest came from, for the deploy log. */
export type CertificateSource = "apksigner" | "keytool";

export interface ApkCertificate {
  sha256: string;
  source: CertificateSource;
}

const HEX_64 = /^[0-9a-f]{64}$/;

/** `AB:CD:...` or `abcd...` to 64 lowercase hex, or null when it is not a SHA-256 digest. */
export function normaliseDigest(value: string): string | null {
  const hex = value.replace(/[:\s]/g, "").toLowerCase();
  return HEX_64.test(hex) ? hex : null;
}

/** The first signer's certificate digest from `apksigner verify --print-certs`. */
export function parseApksignerOutput(output: string): string | null {
  const match = /^Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$/m.exec(output);
  return match ? normaliseDigest(match[1]!) : null;
}

/** The first certificate digest from `keytool -printcert -jarfile` (v1 signatures only). */
export function parseKeytoolOutput(output: string): string | null {
  const match = /SHA-?256:\s*([0-9A-Fa-f:]{64,})/.exec(output);
  return match ? normaliseDigest(match[1]!) : null;
}

function unescapeProperty(value: string): string {
  return value.replace(/\\(.)/g, "$1").trim();
}

/** The Android SDK root: ANDROID_HOME, ANDROID_SDK_ROOT, then `sdk.dir` in local.properties. */
export function androidSdkRoot(
  androidDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  for (const candidate of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  const properties = path.join(androidDir, "local.properties");
  if (!fs.existsSync(properties)) return null;

  const match = /^\s*sdk\.dir\s*=\s*(.+)$/m.exec(fs.readFileSync(properties, "utf8"));
  const sdkDir = match ? unescapeProperty(match[1]!) : null;
  return sdkDir && fs.existsSync(sdkDir) ? sdkDir : null;
}

function compareToolVersions(a: string, b: string): number {
  const left = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (right[index] ?? 0) - (left[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

/** `apksigner` from the newest installed build-tools, or null. */
export function findApksigner(sdkRoot: string | null): string | null {
  if (!sdkRoot) return null;
  const buildTools = path.join(sdkRoot, "build-tools");
  if (!fs.existsSync(buildTools)) return null;

  const name = process.platform === "win32" ? "apksigner.bat" : "apksigner";
  const versions = fs.readdirSync(buildTools).sort(compareToolVersions);

  for (const version of versions) {
    const candidate = path.join(buildTools, version, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** `keytool` from JAVA_HOME, falling back to PATH. */
export function findKeytool(env: NodeJS.ProcessEnv = process.env): string {
  const name = process.platform === "win32" ? "keytool.exe" : "keytool";
  const fromHome = env.JAVA_HOME ? path.join(env.JAVA_HOME, "bin", name) : null;
  return fromHome && fs.existsSync(fromHome) ? fromHome : "keytool";
}

async function attempt(
  file: string,
  args: string[],
  options: Omit<RunOptions, "cwd">,
  cwd: string,
): Promise<string | null> {
  try {
    const result = await run(file, args, { ...options, cwd, timeoutMs: 60_000 });
    return `${result.stdout}\n${result.stderr}`;
  } catch {
    return null;
  }
}

/**
 * Reads the APK signing certificate digest.
 *
 * apksigner understands every signature scheme; keytool only reads v1 (JAR) signatures, which an
 * APK with minSdk 24+ usually omits, so it is the fallback. Null when neither could tell.
 */
export async function readApkCertificate(
  apkPath: string,
  androidDir: string,
  options: Omit<RunOptions, "cwd"> = {},
): Promise<ApkCertificate | null> {
  const apksigner = findApksigner(androidSdkRoot(androidDir));
  if (apksigner) {
    const output = await attempt(
      apksigner,
      ["verify", "--print-certs", apkPath],
      options,
      androidDir,
    );
    const sha256 = output ? parseApksignerOutput(output) : null;
    if (sha256) return { sha256, source: "apksigner" };
  }

  const output = await attempt(
    findKeytool(),
    ["-printcert", "-jarfile", apkPath],
    options,
    androidDir,
  );
  const sha256 = output ? parseKeytoolOutput(output) : null;
  return sha256 ? { sha256, source: "keytool" } : null;
}
