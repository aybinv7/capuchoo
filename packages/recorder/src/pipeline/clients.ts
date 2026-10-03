import { createCompressor } from "./compress.js";
import { createPipeline } from "./pipeline.js";
import type {
  PipelineClient,
  PipelineCommand,
  PipelineReport,
  PipelineSettings,
} from "./protocol.js";
import { createMemoryStore } from "./segmentStore.js";
import { createHttpTransport } from "./transport.js";

type Listener = (report: PipelineReport) => void;

function fanOut() {
  const listeners = new Set<Listener>();
  return {
    emit(report: PipelineReport) {
      for (const listener of listeners) listener(report);
    },
    add(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function sanitize(command: PipelineCommand): PipelineCommand {
  if (command.type !== "events") return command;
  return {
    type: "events",
    events: command.events.flatMap((event) => {
      try {
        structuredClone(event.d);
        return [event];
      } catch {
        try {
          return [{ ...event, d: JSON.parse(JSON.stringify(event.d)) as unknown }];
        } catch {
          return [];
        }
      }
    }),
  };
}

/** Commands go to the recorder worker by structured clone; serialization and I/O happen there. */
export function createWorkerClient(worker: Worker): PipelineClient {
  const reports = fanOut();
  worker.onmessage = (event: MessageEvent<PipelineReport>) => reports.emit(event.data);
  worker.onerror = (event) =>
    reports.emit({ type: "log", level: "error", message: `recorder worker: ${event.message}` });

  return {
    send(command) {
      try {
        worker.postMessage(command);
      } catch {
        worker.postMessage(sanitize(command));
      }
    },
    onReport: (listener) => reports.add(listener),
    terminate() {
      worker.terminate();
    },
  };
}

/**
 * The same pipeline on the main thread, for a host that cannot start the worker. It keeps the
 * buffer in memory and still compresses and uploads; it just competes with rendering to do it.
 */
export function createInlineClient(): PipelineClient {
  const reports = fanOut();
  let settings: PipelineSettings | null = null;
  const pipeline = createPipeline({
    store: createMemoryStore(),
    transport: createHttpTransport(() => settings?.endpoint ?? ""),
    compress: createCompressor(),
    now: () => Date.now(),
    report: reports.emit,
  });

  return {
    send(command) {
      if (command.type === "configure") settings = command.settings;
      pipeline.handle(command);
    },
    onReport: (listener) => reports.add(listener),
    terminate() {
      pipeline.dispose();
    },
  };
}
