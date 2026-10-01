import { createOpfsDialect } from "@cavulsqa/mobile-db/opfs";
import OpfsWorker from "../opfs.worker?worker";
import { probeOpfsCapable } from "../storage";
import type { StorageCandidate } from "./types";

/**
 * Official `@sqlite.org/sqlite-wasm`, `opfs-sahpool` VFS, in a worker.
 *
 * The fastest thing measured on a real phone: reads 2.5-5.5x and batched writes ~9x against the
 * Capacitor bridge, with much tighter worst cases. The SAH pool is chosen over the plain `opfs` VFS
 * because it needs neither SharedArrayBuffer nor cross-origin isolation, and a Capacitor WebView
 * cannot easily be given COOP/COEP headers.
 */
export const opfsSahPool: StorageCandidate = {
  id: "sqlite-wasm-opfs-sahpool",
  label: "SQLite WASM · OPFS sync access handle pool",
  tradeoff:
    "One connection per directory, taken exclusively - a stale handle blocks the open. The worker " +
    "is serial, so a read waits behind an in-flight write.",
  durable: true,
  evidence: "measured",
  probe: probeOpfsCapable,
  createDialect: () =>
    Promise.resolve(createOpfsDialect({ worker: new OpfsWorker(), name: "app.sqlite3" })),
};
