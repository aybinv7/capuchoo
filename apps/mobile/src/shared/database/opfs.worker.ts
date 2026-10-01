import { runOpfsWorker } from "@cavulsqa/mobile-db/opfs";

// The whole worker. It lives in the app rather than the package because only the app's bundler can
// emit a worker and the sqlite3.wasm it loads; the logic is all in @cavulsqa/mobile-db.
runOpfsWorker();
