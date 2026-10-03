import { RECORDING_WIRE_LIMITS } from "@capuchoo/core";
import type { AssetRequest } from "./protocol.js";
import type { Transport } from "./transport.js";

const MAX_ASSETS_PER_VERSION = 80;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function contentTypeFor(path: string, header: string | null): string {
  const declared = header?.split(";")[0]?.trim();
  if (declared && declared !== "application/octet-stream") return declared;
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads the stylesheets a replay needs, and the fonts and images they reference, once per app
 * version: the server lists what it already has, so a fleet uploads each file a single time.
 */
export function createAssetUploader(transport: Transport, warn: (message: string) => void) {
  const done = new Set<string>();
  let running: Promise<void> = Promise.resolve();

  async function upload(request: AssetRequest): Promise<void> {
    const known = new Set(request.known);
    const queue = [...request.urls];
    let sent = 0;

    while (queue.length > 0 && sent < MAX_ASSETS_PER_VERSION) {
      const raw = queue.shift()!;
      let url: URL;
      try {
        url = new URL(raw, self.location.href);
      } catch {
        continue;
      }
      if (url.origin !== self.location.origin) continue;
      const path = url.pathname;
      const key = `${request.versionName}:${path}`;
      if (known.has(path) || done.has(key)) continue;
      done.add(key);

      let response: Response;
      try {
        response = await fetch(url.href, { credentials: "omit" });
      } catch {
        continue;
      }
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > RECORDING_WIRE_LIMITS.assetBytes) continue;
      const contentType = contentTypeFor(path, response.headers.get("content-type"));

      if (contentType === "text/css") {
        const text = new TextDecoder().decode(bytes);
        for (const match of text.matchAll(CSS_URL)) {
          const reference = match[2]?.trim();
          if (reference && !reference.startsWith("data:")) {
            queue.push(new URL(reference, url.href).href);
          }
        }
      }

      const outcome = await transport.sendAsset(
        {
          appId: request.appId,
          versionName: request.versionName,
          path,
          sha256: await sha256Hex(bytes),
          contentType,
        },
        bytes,
      );
      if (outcome === "retry") done.delete(key);
      else sent++;
    }
  }

  return {
    enqueue(request: AssetRequest): void {
      running = running
        .then(() => upload(request))
        .catch((error: unknown) => warn(`asset upload failed: ${String(error)}`));
    },
  };
}
