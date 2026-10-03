export type Compressor = (text: string) => Promise<Uint8Array>;

async function viaStream(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let fallback: Promise<(data: Uint8Array) => Uint8Array> | null = null;

async function viaFflate(text: string): Promise<Uint8Array> {
  fallback ??= import("fflate").then((module) => (data) => module.gzipSync(data, { level: 6 }));
  return (await fallback)(new TextEncoder().encode(text));
}

/** Native gzip where the WebView has it (Chrome 80+), fflate loaded on demand where it does not. */
export function createCompressor(): Compressor {
  return typeof CompressionStream === "function" ? viaStream : viaFflate;
}
