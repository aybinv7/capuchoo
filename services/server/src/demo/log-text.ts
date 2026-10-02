/** What a step printed, before timestamps are added: the lines GitHub's runner would write. */
export type StepScript = string[];

const SETUP = [
  "Current runner version: '2.337.0'",
  "##[group]Runner Image",
  "Image: ubuntu-24.04",
  "Version: 20260921.1",
  "##[endgroup]",
  "##[group]GITHUB_TOKEN Permissions",
  "Contents: read",
  "Metadata: read",
  "##[endgroup]",
  "Secret source: Actions",
  "Prepare workflow directory",
  "Prepare all required actions",
];

const CHECKOUT = [
  "##[group]Run actions/checkout@v5",
  "with:",
  "  repository: northwind/field-sales",
  "  fetch-depth: 1",
  "##[endgroup]",
  "Syncing repository: northwind/field-sales",
  "[command]/usr/bin/git version",
  "git version 2.51.0",
  "[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin",
  "remote: Enumerating objects: 1243, done.",
  "Receiving objects: 100% (1243/1243), 4.21 MiB | 18.32 MiB/s, done.",
];

const SETUP_NODE = [
  "##[group]Run actions/setup-node@v5",
  "with:",
  "  node-version: 22",
  "##[endgroup]",
  "Found in cache @ /opt/hostedtoolcache/node/22.20.0/x64",
  "[command]/opt/hostedtoolcache/node/22.20.0/x64/bin/node --version",
  "v22.20.0",
];

const CACHE = [
  "##[group]Run actions/cache@v4",
  "with:",
  "  path: ~/.cache/capuchoo-pm",
  "##[endgroup]",
  "Cache Size: ~104 MB (108049218 B)",
  "Cache restored successfully",
  "Cache restored from key: capuchoo-pm-Linux-3f1c9a",
];

const INSTALL = [
  "##[group]Run set -euo pipefail",
  "set -euo pipefail",
  'STORE="$HOME/.cache/capuchoo-pm"',
  "##[endgroup]",
  "added 1 package in 2s",
  "Lockfile is up to date, resolution step is skipped",
  "Packages: +812",
  "Progress: resolved 812, reused 812, downloaded 0, added 812, done",
  "\u001b[32mDone in 8.9s\u001b[39m using pnpm v11.24.0",
];

const POST = ["Post job cleanup."];
const COMPLETE = ["Cleaning up orphan processes"];

export function deployScript(options: {
  command: string;
  version: string;
  channel: string;
  kind: "ota" | "native";
  failure?: { step: string; message: string } | null;
  dryRun?: boolean;
}): StepScript {
  const steps =
    options.kind === "native"
      ? [
          "Resolving flavour and version",
          "Generating launcher assets",
          "Building web assets",
          "Applying native configuration",
          "Syncing Capacitor",
          "Compiling the APK",
          "Signing",
          "Uploading",
        ]
      : [
          "Resolving flavour and version",
          "Generating launcher assets",
          "Building web assets",
          "Applying native configuration",
          "Syncing Capacitor",
          "Bundling",
          "Uploading",
        ];
  const mode = options.channel.startsWith("prod") ? "prod" : options.channel;
  const lines = [`##[group]Run ${options.command}`, options.command, "##[endgroup]"];
  for (const [index, label] of steps.entries()) {
    lines.push(`[${index + 1}/${steps.length}] ${label}`);
    if (index === 0) lines.push(`      - ${mode} flavour, v${options.version}, pnpm workspace`);
    if (label === "Generating launcher assets") lines.push("- skipped: no launcher artwork");
    if (label === "Building web assets") {
      lines.push(
        `      - vp build --mode ${mode}`,
        "\u001b[32m✓\u001b[39m 2545 modules transformed.",
        "dist/assets/index-Cx81fq.js   412.18 kB │ gzip: 128.40 kB",
      );
    }
    if (label === "Syncing Capacitor" && options.kind === "ota") {
      lines.push("- skipped: no android/ project, and an OTA bundle does not need one");
    }
    if (label === "Compiling the APK")
      lines.push("> Task :app:assembleRelease", "BUILD SUCCESSFUL in 3m 41s");
    if (options.failure && label.toLowerCase().startsWith(options.failure.step)) {
      lines.push(
        `\u001b[31m✗ Deploy failed during ${label}\u001b[39m`,
        `##[error]${options.failure.message}`,
        "##[error]Process completed with exit code 1.",
      );
      return lines;
    }
  }
  lines.push(
    options.dryRun
      ? `\u001b[32m✓ Rehearsed ${options.kind.toUpperCase()} ${options.version} → ${options.channel}. Nothing uploaded.\u001b[39m`
      : `\u001b[32m✓ Published ${options.kind.toUpperCase()} ${options.version} → ${options.channel}\u001b[39m`,
  );
  return lines;
}

export function uploadScript(name: string): StepScript {
  return [
    "##[group]Run actions/upload-artifact@v4",
    "with:",
    `  name: ${name}`,
    "##[endgroup]",
    "With the provided path, there will be 2 files uploaded",
    `Artifact ${name} has been successfully uploaded! Final size is 18342 bytes.`,
  ];
}

export const STEP_SCRIPTS = {
  SETUP,
  CHECKOUT,
  SETUP_NODE,
  CACHE,
  INSTALL,
  POST,
  COMPLETE,
} as const;

/** A step's lines with GitHub's timestamps, spread over the step's duration. */
export function stamp(lines: StepScript, from: Date, seconds: number): string[] {
  const span = Math.max(0.2, seconds - 0.1) * 1000;
  return lines.map((line, index) => {
    const at = new Date(
      from.getTime() + 120 + Math.floor((span * index) / Math.max(1, lines.length)),
    );
    return `${at.toISOString().replace(/\.(\d{3})Z$/, ".$1" + "0000Z")} ${line}`;
  });
}
