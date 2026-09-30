import type { StepStatus } from "../utils/reporter.js";
import type { BuildFinish, BuildStart, BuildStep } from "../services/wire.js";

/** The subset of `CloudClient` the tracker talks to, so tests need no HTTP. */
export interface BuildApi {
  createBuild(cloudAppId: string, input: BuildStart, timeoutMs: number): Promise<{ id: string }>;
  buildEvent(
    buildId: string,
    input: { step: BuildStep; status: StepStatus; message: string },
    timeoutMs: number,
  ): Promise<unknown>;
  finishBuild(buildId: string, input: BuildFinish, timeoutMs: number): Promise<unknown>;
}

export interface TrackerOptions {
  /** Per request. */
  timeoutMs?: number;
  /** How long `finish` waits for the queue to drain before giving up on it. */
  flushTimeoutMs?: number;
  /** Events beyond this many waiting are dropped rather than queued. */
  maxQueue?: number;
}

const PIPELINE_TO_BUILD_STEP: Readonly<Record<string, BuildStep>> = {
  resolve: "resolve",
  assets: "assets",
  web: "web",
  "native-config": "native",
  sync: "sync",
  bundle: "bundle",
  compile: "bundle",
  sign: "sign",
  upload: "upload",
};

/** The build-status step a pipeline step reports as, or null for steps the server does not track. */
export function toBuildStep(pipelineStep: string): BuildStep | null {
  return PIPELINE_TO_BUILD_STEP[pipelineStep] ?? null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

/**
 * Best-effort live build status. Every call returns at once; requests run one at a time in order
 * on a background chain with a short timeout, the first failure stops all further requests, and
 * nothing here ever throws into the deploy.
 */
export class BuildTracker {
  private chain: Promise<void>;
  private readonly id: Promise<string | null>;
  private pending = 0;
  private broken = false;
  private closed = false;
  private abandoned = false;
  private readonly timeoutMs: number;
  private readonly flushTimeoutMs: number;
  private readonly maxQueue: number;

  private constructor(
    private readonly api: BuildApi | null,
    create: (() => Promise<{ id: string }>) | null,
    options: TrackerOptions,
  ) {
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.flushTimeoutMs = options.flushTimeoutMs ?? 5_000;
    this.maxQueue = options.maxQueue ?? 64;
    this.id = create
      ? create().then(
          (build) => (typeof build?.id === "string" ? build.id : null),
          () => null,
        )
      : Promise.resolve(null);
    this.chain = this.id.then(
      () => undefined,
      () => undefined,
    );
  }

  /** Starts creating the build in the background; never waits for it. */
  static start(
    api: BuildApi,
    cloudAppId: string,
    input: BuildStart,
    options: TrackerOptions = {},
  ): BuildTracker {
    const timeoutMs = options.timeoutMs ?? 3_000;
    return new BuildTracker(api, () => api.createBuild(cloudAppId, input, timeoutMs), options);
  }

  /** A tracker that reports nothing, for dry runs. */
  static disabled(): BuildTracker {
    return new BuildTracker(null, null, {});
  }

  private enqueue(send: (api: BuildApi, id: string) => Promise<unknown>, force = false): void {
    if (!this.api || this.closed || (!force && this.pending >= this.maxQueue)) return;
    const api = this.api;
    this.pending += 1;
    this.chain = this.chain.then(async () => {
      try {
        const id = await this.id;
        if (!id || this.broken || this.abandoned) return;
        await send(api, id);
      } catch {
        this.broken = true;
      } finally {
        this.pending -= 1;
      }
    });
  }

  /** Queues a step event; pipeline steps the server does not track are ignored. */
  step(pipelineStep: string, status: StepStatus, message: string): void {
    const step = toBuildStep(pipelineStep);
    if (!step) return;
    this.enqueue((api, id) =>
      api.buildEvent(id, { step, status, message: message.slice(0, 2_000) }, this.timeoutMs),
    );
  }

  /** The build id if creation has finished within `waitMs`, for the upload's `build_id`. */
  async buildId(waitMs = 1_000): Promise<string | undefined> {
    const id = await Promise.race([this.id, delay(waitMs).then(() => null)]);
    return id ?? undefined;
  }

  /** Queues the finish and waits for the queue to drain, at most `flushTimeoutMs`. */
  async finish(input: BuildFinish): Promise<void> {
    this.enqueue(
      (api, id) =>
        api.finishBuild(
          id,
          input.error ? { ...input, error: input.error.slice(0, 4_000) } : input,
          this.timeoutMs,
        ),
      true,
    );
    this.closed = true;
    await Promise.race([this.chain, delay(this.flushTimeoutMs)]);
    this.abandoned = true;
  }
}
