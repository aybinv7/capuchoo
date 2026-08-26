#!/usr/bin/env node
/**
 * Refuses a release that would ship a package against a stale dependency.
 *
 * `@capuchoo/cli@0.5.0` was published importing `canPublishTo` from
 * `@capuchoo/core`. The import type-checked, the build passed, the tests
 * passed - because in the workspace `@capuchoo/core` is the local source. But
 * core's version had not been bumped, so `workspace:^` was rewritten to
 * `^0.1.0`, npm installed the 0.1.0 already on the registry, and the CLI died
 * on first run with "does not provide an export named 'canPublishTo'". Nothing
 * in the pipeline could see it: every check ran against the workspace, and the
 * registry is the only place the truth lived.
 *
 * So this compares the two. For each publishable package whose version is
 * already on npm, it fetches what was published at that exact version and
 * compares the public API. If they differ, the package changed without a bump,
 * and anything depending on it is about to be published against the old one.
 *
 * What it does not catch: a changed *signature* behind an unchanged name, and a
 * changed implementation behind an unchanged surface. Those are real, and a
 * bump is still the author's judgement - this only removes the case that has
 * actually bitten, where a name a sibling imports simply is not there.
 *
 * Usage:  node scripts/check-release.mjs
 * Exits non-zero if a release would be unsafe.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const REGISTRY = "https://registry.npmjs.org";

/** Every `export { ... }` name in a bundled declaration file. */
function exportedNames(declaration) {
  const names = new Set();

  for (const block of declaration.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const entry of block[1].split(",")) {
      // `type Foo`, `Foo as Bar`, and plain `Foo` all name one export; an alias
      // is the name consumers import, so it wins.
      const name = entry
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }

  return names;
}

/**
 * The files in a gzipped tar, by path.
 *
 * A dependency-free ustar reader: npm tarballs are flat, short-named and
 * uncompressed-per-entry, so the 512-byte header walk is the whole format.
 */
function readTarball(gzipped) {
  const buffer = gunzipSync(gzipped);
  const files = new Map();
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    if (!name) break; // the two zero blocks that end the archive

    const size =
      Number.parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/s, "").trim(), 8) ||
      0;
    const type = header.subarray(156, 157).toString("utf8");
    offset += 512;

    // "0" and "\0" are regular files; anything else (directories, pax headers)
    // is skipped along with its payload.
    if (type === "0" || type === "\0") {
      files.set(name, buffer.subarray(offset, offset + size).toString("utf8"));
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}

/**
 * Every published type declaration in a package's dist, by its path.
 *
 * Not just `index.d.ts`. A package with subpath exports has an entry point per
 * subpath - `@capuchoo/updater` publishes `dist/capacitor-config.d.ts` for its
 * `/capacitor` export, which `capacitor.config.ts` imports and nothing else
 * does. Comparing only the main entry would let that surface change under an
 * unchanged version number, which is the exact mistake this script exists to
 * catch.
 */
function declarations(root) {
  const found = new Map();

  const walk = (path, prefix) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(full, relative);
      } else if (entry.name.endsWith(".d.ts")) {
        found.set(relative, readFileSync(full, "utf8"));
      }
    }
  };

  try {
    walk(root, "");
  } catch {
    // Reported by the caller as a missing build.
  }

  return found;
}

/**
 * An oclif CLI's public surface is its commands, not its exported types.
 *
 * Adding a command changes nothing in `dist/index.d.ts`, so the declaration diff
 * reports the package unchanged.
 */
function commandIds(paths) {
  return new Set(
    paths
      .filter((path) => /(^|\/)dist\/commands\/.+\.js$/.test(path) && !path.endsWith(".map"))
      .map((path) => path.replace(/^.*dist\/commands\//, "").replace(/\.js$/, "")),
  );
}

/** Every file under a directory, relative to it. */
function filesUnder(root, prefix = "") {
  const found = [];

  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) found.push(...filesUnder(join(root, entry.name), relative));
      else found.push(relative);
    }
  } catch {
    // Missing build; reported by the caller.
  }

  return found;
}

/**
 * Every sibling dependency must be declared with `workspace:`.
 *
 * pnpm rewrites it at pack time to a caret on the sibling's current version, so
 * the range always points at the version whose surface is checked here. Below
 * 1.0.0 a caret does not cross a minor, so a hand-written `^0.1.2` can never
 * pick up 0.2.0 - which is how cli@0.5.0 shipped importing an export it could
 * not resolve.
 */
function nonWorkspaceSiblings(manifest) {
  const deps = { ...manifest.dependencies, ...manifest.peerDependencies };

  return Object.entries(deps)
    .filter(([name, range]) => name.startsWith("@capuchoo/") && !range.startsWith("workspace:"))
    .map(([name, range]) => `${name}: "${range}"`);
}

async function publishedMetadata(name) {
  const response = await fetch(`${REGISTRY}/${name.replace("/", "%2F")}`, {
    headers: { accept: "application/vnd.npm.install-v1+json" },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`registry returned ${response.status} for ${name}`);
  }

  return response.json();
}

function publishablePackages() {
  const found = [];

  for (const entry of readdirSync("packages", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = join("packages", entry.name);
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }

    if (manifest.private || !manifest.name || !manifest.version) continue;
    found.push({ dir, name: manifest.name, version: manifest.version, manifest });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

const problems = [];
const lines = [];

const byName = (a, b) => a.localeCompare(b);

for (const pkg of publishablePackages()) {
  // Checked first, and offline: it is what makes everything below sound. pnpm
  // rewrites `workspace:` at pack time to a caret on the sibling's current
  // version, so the range always points at the version whose surface is
  // compared here. A hand-written range severs that link.
  const handWritten = nonWorkspaceSiblings(pkg.manifest);
  if (handWritten.length > 0) {
    problems.push(
      `${pkg.name} declares a sibling by version instead of workspace: ` +
        `${handWritten.join(", ")}.\n` +
        `    Use "workspace:^" so pack time pins the version actually being released.\n` +
        `    A fixed range goes stale silently, and below 1.0.0 a caret cannot cross a\n` +
        `    minor - which is how cli@0.5.0 shipped needing core ^0.1.2 while importing\n` +
        `    an export added in 0.2.0.`,
    );
  }

  const local = declarations(join(pkg.dir, "dist"));
  if (local.size === 0) {
    problems.push(`${pkg.name}: no built types. Run "vp run -r build" before releasing.`);
    continue;
  }

  const metadata = await publishedMetadata(pkg.name);
  const release = metadata?.versions?.[pkg.version];

  if (!release) {
    lines.push(`  new      ${pkg.name}@${pkg.version} is not on the registry - it will publish`);
    continue;
  }

  const tarball = await fetch(release.dist.tarball);
  if (!tarball.ok) {
    problems.push(`${pkg.name}: could not fetch the published tarball (${tarball.status})`);
    continue;
  }

  const files = readTarball(Buffer.from(await tarball.arrayBuffer()));

  // Every entry point, not only index. A package with subpath exports has one
  // declaration per subpath, and a change in any of them is a change to what a
  // consumer can import.
  const entryPoints = new Set([
    ...local.keys(),
    ...[...files.keys()]
      .filter((path) => path.startsWith("package/dist/") && path.endsWith(".d.ts"))
      .map((path) => path.slice("package/dist/".length)),
  ]);

  const added = [];
  const removed = [];

  for (const entry of [...entryPoints].sort(byName)) {
    const before = exportedNames(files.get(`package/dist/${entry}`) ?? "");
    const after = exportedNames(local.get(entry) ?? "");

    for (const name of after) if (!before.has(name)) added.push(`${entry}:${name}`);
    for (const name of before) if (!after.has(name)) removed.push(`${entry}:${name}`);
  }

  if (pkg.manifest.oclif) {
    const before = commandIds([...files.keys()]);
    const after = commandIds(filesUnder(join(pkg.dir, "dist"), "dist"));

    for (const id of after) if (!before.has(id)) added.push(`command:${id}`);
    for (const id of before) if (!after.has(id)) removed.push(`command:${id}`);
  }

  if (added.length === 0 && removed.length === 0) {
    lines.push(`  same     ${pkg.name}@${pkg.version} matches the registry - it will be skipped`);
    continue;
  }

  const changes = [
    added.length ? `adds ${added.sort(byName).join(", ")}` : null,
    removed.length ? `removes ${removed.sort(byName).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  problems.push(
    `${pkg.name}@${pkg.version} is already on the registry with a different public API ` +
      `(${changes}).\n` +
      `    Bump ${pkg.dir}/package.json before releasing. Publishing as-is is a no-op for\n` +
      `    this package, and anything depending on it resolves to the version already there\n` +
      `    - which is exactly how the CLI shipped against a core that lacked canPublishTo.`,
  );
}

if (lines.length) console.log(lines.join("\n"));

if (problems.length) {
  console.error(`\nRelease blocked:\n\n${problems.map((p) => `  - ${p}`).join("\n\n")}\n`);
  process.exit(1);
}

console.log("\nEvery publishable package is safe to release.");
