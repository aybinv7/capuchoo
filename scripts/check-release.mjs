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
    found.push({ dir, name: manifest.name, version: manifest.version });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

const DECLARATION = "dist/index.d.ts";

const problems = [];
const lines = [];

for (const pkg of publishablePackages()) {
  let local;
  try {
    local = readFileSync(join(pkg.dir, DECLARATION), "utf8");
  } catch {
    problems.push(`${pkg.name}: no ${DECLARATION}. Run "vp run -r build" before releasing.`);
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
  const published = files.get(`package/${DECLARATION}`);

  if (published === undefined) {
    lines.push(`  skipped  ${pkg.name}@${pkg.version} published without ${DECLARATION}`);
    continue;
  }

  const before = exportedNames(published);
  const after = exportedNames(local);

  const byName = (a, b) => a.localeCompare(b);
  const added = [...after].filter((name) => !before.has(name)).sort(byName);
  const removed = [...before].filter((name) => !after.has(name)).sort(byName);

  if (added.length === 0 && removed.length === 0) {
    lines.push(`  same     ${pkg.name}@${pkg.version} matches the registry - it will be skipped`);
    continue;
  }

  const changes = [
    added.length ? `adds ${added.join(", ")}` : null,
    removed.length ? `removes ${removed.join(", ")}` : null,
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
