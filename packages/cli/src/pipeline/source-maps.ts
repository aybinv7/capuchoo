import fs from "node:fs";
import path from "node:path";

export interface SourceMapFile {
  /** Forward-slash path relative to the web directory, as the bundle serves it. */
  path: string;
  file: string;
}

/** Every `.map` file under `root`. Symlinks are not followed. */
export function findSourceMaps(root: string): SourceMapFile[] {
  if (!fs.existsSync(root)) return [];
  const found: SourceMapFile[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      const absolute = path.join(dir, item.name);
      if (item.isDirectory()) walk(absolute, name);
      else if (item.isFile() && item.name.endsWith(".map"))
        found.push({ path: name, file: absolute });
    }
  };
  walk(root, "");
  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Removes the source maps Capacitor copied into a native project's web assets, so the binary does
 * not carry the app's sources. Only the copy is touched; the build output keeps its maps for upload.
 */
export function stripSourceMaps(nativeWebDir: string): number {
  const maps = findSourceMaps(nativeWebDir);
  for (const map of maps) fs.rmSync(map.file, { force: true });
  return maps.length;
}

/** Where `cap sync` puts the web assets of an Android project. */
export function androidWebAssets(androidDir: string): string {
  return path.join(androidDir, "app", "src", "main", "assets", "public");
}
