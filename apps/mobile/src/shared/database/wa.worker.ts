import { runWaWorker } from "@cavulsqa/mobile-db/wa";

// The whole worker. It lives in the app because only the app's bundler can emit a worker and the
// wa-sqlite wasm it loads; the logic is all in @cavulsqa/mobile-db.
runWaWorker();
