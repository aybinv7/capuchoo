import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Writes the OTA bundle archive.
 *
 * The pipeline used to run `npx @capgo/cli bundle zip <appId> --json` for this,
 * which meant a deploy could not run offline, depended on a third-party CLI
 * resolved at deploy time, and dropped the archive somewhere in the project
 * root - after which `findLatestZip` picked *the newest .zip in the directory*,
 * whatever it was, and deleted it on success.
 *
 * The archive format is dictated by `@capgo/capacitor-updater`, which unpacks
 * it on the device. Two of its rules are easy to break and fail only on a real
 * phone:
 *
 *  1. Entry names must use forward slashes. The Android unzip rejects any entry
 *     containing a backslash outright ("Windows path not supported"), so a
 *     naive `path.join` on Windows produces an archive that installs nowhere.
 *  2. After unpacking, if the extracted directory holds exactly one entry and
 *     that entry is not `index.html`, the plugin treats it as a wrapper and
 *     descends into it. Writing the web assets at the archive root - which is
 *     what this does - keeps that logic out of the picture entirely.
 *
 * The plugin also validates that `index.html` exists at the bundle root, so
 * that is checked before anything is written.
 */

const LOCAL_HEADER = 0x04_03_4b_50;
const CENTRAL_HEADER = 0x02_01_4b_50;
const END_OF_CENTRAL_DIR = 0x06_05_4b_50;
const ZIP_VERSION = 20; // 2.0 - deflate
const DEFLATED = 8;
const MAX_ZIP_SIZE = 0xff_ff_ff_ff; // 4 GiB - beyond this ZIP64 is required.

/** Files that must never reach a device. */
const EXCLUDED = new Set([".DS_Store", "Thumbs.db", ".gitkeep", "capucho-deploy.log"]);

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Int32Array {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Encodes a timestamp as MS-DOS date and time.
 *
 * A fixed timestamp keeps the archive byte-for-byte reproducible: rebuilding
 * the same bundle twice produces the same checksum, so the backend can tell a
 * genuine change from a rebuild.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (Math.floor(date.getSeconds() / 2) & 0x1f) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getHours() & 0x1f) << 11);
  const day =
    (date.getDate() & 0x1f) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (((date.getFullYear() - 1980) & 0x7f) << 9);
  return { time, date: day };
}

interface Entry {
  /** Archive-relative name, always forward-slash separated. */
  name: string;
  source: string;
}

/** Collects files under `root`, depth first, with forward-slash names. */
function collect(root: string, prefix = ""): Entry[] {
  const entries: Entry[] = [];

  for (const item of fs
    .readdirSync(root, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (EXCLUDED.has(item.name)) continue;

    const absolute = path.join(root, item.name);
    // Built with "/" explicitly rather than path.join, which would emit "\"
    // on Windows and produce an archive the Android plugin refuses.
    const name = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      entries.push(...collect(absolute, name));
    } else if (item.isFile()) {
      entries.push({ name, source: absolute });
    }
    // Symlinks are skipped: the plugin has no way to reproduce them and
    // following one could pull in files from outside the web directory.
  }

  return entries;
}

export interface BundleResult {
  zipPath: string;
  fileCount: number;
  byteSize: number;
}

export interface BundleOptions {
  /** Directory whose *contents* become the archive root. */
  webDir: string;
  /** Where to write the archive. */
  outFile: string;
  /** Fixed modification time, for reproducible archives. */
  mtime?: Date;
}

/** Builds the OTA archive from a built web directory. */
export function createBundleZip(options: BundleOptions): BundleResult {
  const { webDir, outFile } = options;

  if (!fs.existsSync(webDir)) {
    throw new Error(
      `Web directory "${webDir}" does not exist. The build step produced nothing to publish.`,
    );
  }

  if (!fs.existsSync(path.join(webDir, "index.html"))) {
    throw new Error(
      `"${webDir}" has no index.html at its root. ` +
        "@capgo/capacitor-updater rejects a bundle without one, so this archive " +
        "would download on every device and then fail to apply.",
    );
  }

  const entries = collect(webDir);
  if (entries.length === 0) {
    throw new Error(`"${webDir}" is empty, so there is nothing to publish.`);
  }

  // 1980-01-01, the earliest representable MS-DOS timestamp.
  const stamp = dosDateTime(options.mtime ?? new Date(Date.UTC(1980, 0, 1)));

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const contents = fs.readFileSync(entry.source);
    const compressed = zlib.deflateRawSync(contents, { level: 9 });
    const nameBytes = Buffer.from(entry.name, "utf8");
    const crc = crc32(contents);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(ZIP_VERSION, 4);
    // Bit 11 marks the name as UTF-8, which matters for non-ASCII asset names.
    local.writeUInt16LE(0x08_00, 6);
    local.writeUInt16LE(DEFLATED, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    central.writeUInt16LE(ZIP_VERSION, 4);
    central.writeUInt16LE(ZIP_VERSION, 6);
    central.writeUInt16LE(0x08_00, 8);
    central.writeUInt16LE(DEFLATED, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    // Regular file, mode 0644, in the high word where Unix permissions live.
    // `>>> 0` is required: the shift alone overflows into a negative int32,
    // which writeUInt32LE rejects.
    central.writeUInt32LE((0o10_0644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
    if (offset > MAX_ZIP_SIZE) {
      throw new Error("The web bundle exceeds 4 GiB, which needs ZIP64. Reduce the bundle size.");
    }
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  const archive = Buffer.concat([...localParts, centralDirectory, end]);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, archive);

  return {
    zipPath: outFile,
    fileCount: entries.length,
    byteSize: archive.length,
  };
}

/**
 * Names the archive after the app and version rather than dropping a bare
 * `<version>.zip` in the project root, so a stray archive is identifiable and
 * the gitignore rule can match it.
 */
export function bundleFileName(appId: string, version: string): string {
  const safe = `${appId}-${version}`.replaceAll(/[^\w.-]/g, "-");
  return `capucho-bundle-${safe}.zip`;
}
