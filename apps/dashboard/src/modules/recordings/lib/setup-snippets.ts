/** How the app stores data, which decides how its writes reach the recording. */
export type SetupEngine = "cavulsqa" | "sqlite" | "none";

export interface Snippet {
  file: string;
  language: "ts" | "bash";
  code: string;
}

export const SETUP_ENGINES: ReadonlyArray<{ id: SetupEngine; label: string; detail: string }> = [
  {
    id: "cavulsqa",
    label: "cavulsqa OPFS",
    detail:
      "Every committed transaction as a SQLite changeset, recorded inside the database worker.",
  },
  {
    id: "sqlite",
    label: "Any SQLite",
    detail:
      "wa-sqlite, @capacitor-community/sqlite or anything with a query function: rows with their values, through temporary triggers.",
  },
  {
    id: "none",
    label: "No database",
    detail: "Screen, console, network, performance and telemetry only.",
  },
];

export const installSnippet: Snippet = {
  file: "terminal",
  language: "bash",
  code: "pnpm add @capuchoo/recorder",
};

export const workerSnippet: Snippet = {
  file: "src/shared/recording/recorder.worker.ts",
  language: "ts",
  code: `import { runRecorderWorker } from "@capuchoo/recorder/worker";

runRecorderWorker();`,
};

const IMPORTS: Record<SetupEngine, string> = {
  cavulsqa: `import { changesetSource, createRecorder, sqlChangesSource, type ExecuteSql } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import { CompiledQuery } from "kysely";
import { changeCapture } from "@/shared/database/changeCapture";
import { changeBus, getDatabase, openDatabase } from "@/shared/database/database";
import RecorderWorker from "@/shared/recording/recorder.worker?worker";`,
  sqlite: `import { createRecorder, sqlChangesSource, type ExecuteSql } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import { db, openDatabase } from "@/shared/database";
import RecorderWorker from "@/shared/recording/recorder.worker?worker";`,
  none: `import { createRecorder } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import RecorderWorker from "@/shared/recording/recorder.worker?worker";`,
};

const EXECUTE: Record<SetupEngine, string> = {
  cavulsqa: `const execute: ExecuteSql = async (sql, parameters = []) =>
  (await getDatabase().db.executeQuery<Record<string, unknown>>(CompiledQuery.raw(sql, [...parameters]))).rows;

`,
  sqlite: `const execute: ExecuteSql = (sql, parameters = []) => db.query(sql, [...parameters]);

`,
  none: "",
};

const DATABASES: Record<SetupEngine, string> = {
  cavulsqa: `  databases: [
    changesetSource(changeCapture, {
      name: "app",
      execute,
      ready: openDatabase,
      fallback: sqlChangesSource({ name: "app", execute, bus: changeBus }),
    }),
  ],
`,
  sqlite: `  databases: [sqlChangesSource({ name: "app", execute, ready: openDatabase })],
`,
  none: "",
};

export function pluginSnippet(engine: SetupEngine): Snippet {
  return {
    file: "src/plugins/recorder.plugin.ts",
    language: "ts",
    code: `${IMPORTS[engine]}

${EXECUTE[engine]}export const recorder = createRecorder({
  identity: updaterIdentity(),
  worker: () => new RecorderWorker(),
${DATABASES[engine]}  onShake: () => recorder.report(),
});

export function recorderPlugin(): Promise<void> {
  return recorder.start();
}`,
  };
}

export const mainSnippet: Snippet = {
  file: "src/main.ts",
  language: "ts",
  code: `void notifyAppReady();

// Before the database opens: a boot that fails is exactly what you want recorded.
void recorderPlugin();

void bootstrap();`,
};

export const captureSnippet: Snippet = {
  file: "src/shared/database/candidates/opfsSahPool.ts",
  language: "ts",
  code: `createOpfsDialect({ ...options, capture: changeCapture });`,
};

export const extrasSnippet: Snippet = {
  file: "anywhere in the app",
  language: "ts",
  code: `recorder.mark("route", { url });
recorder.escalate("session", { reason: "payment failed" });
recorder.report({ note: "Order did not sync" });
recorder.telemetry.event("checkout", { lines: 3 });`,
};
