import { createCompressor } from "./compress.js";
import { createOpfsStore, opfsAvailable } from "./opfsStore.js";
import { createPipeline, type Pipeline } from "./pipeline.js";
import type { PipelineCommand, PipelineReport, PipelineSettings } from "./protocol.js";
import { createMemoryStore, type SegmentStore } from "./segmentStore.js";
import { createHttpTransport } from "./transport.js";

interface WorkerScope {
  postMessage(message: PipelineReport): void;
  onmessage: ((event: { data: PipelineCommand }) => void) | null;
}

/**
 * The worker half of the recorder. The application owns a two-line worker file so its bundler emits
 * the worker; the logic lives here.
 *
 * ```ts
 * // src/recorder.worker.ts
 * import { runRecorderWorker } from "@capuchoo/recorder/worker";
 * runRecorderWorker();
 * ```
 */
export function runRecorderWorker(scope: WorkerScope = globalThis as unknown as WorkerScope): void {
  let settings: PipelineSettings | null = null;
  const backlog: PipelineCommand[] = [];
  let pipeline: Pipeline | null = null;

  const report = (message: PipelineReport) => scope.postMessage(message);

  const ready = (async (): Promise<SegmentStore> => {
    if (!opfsAvailable()) return createMemoryStore();
    try {
      return await createOpfsStore();
    } catch (error) {
      report({
        type: "log",
        level: "warn",
        message: `OPFS unavailable, recording to memory: ${String(error)}`,
      });
      return createMemoryStore();
    }
  })().then((store) => {
    pipeline = createPipeline({
      store,
      transport: createHttpTransport(() => settings?.endpoint ?? ""),
      compress: createCompressor(),
      now: () => Date.now(),
      report,
    });
    for (const command of backlog.splice(0)) pipeline.handle(command);
  });

  scope.onmessage = (event) => {
    const command = event.data;
    if (command.type === "configure") settings = command.settings;
    if (pipeline) pipeline.handle(command);
    else backlog.push(command);
  };

  void ready;
}
