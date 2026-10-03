import type { RecordingTrack } from "@capuchoo/core";
import type { Track, TrackContext } from "./types.js";

/** Starts and stops tracks to match the policy, leaving running ones alone. */
export class TrackSet {
  readonly #tracks: readonly Track[];
  readonly #context: TrackContext;
  readonly #running = new Set<RecordingTrack>();

  constructor(tracks: readonly Track[], context: TrackContext) {
    this.#tracks = tracks;
    this.#context = context;
  }

  apply(enabled: Readonly<Record<RecordingTrack, boolean>>): void {
    for (const track of this.#tracks) {
      const wanted = enabled[track.name];
      const running = this.#running.has(track.name);
      if (wanted && !running) {
        this.#running.add(track.name);
        try {
          void Promise.resolve(track.start(this.#context)).catch((error: unknown) =>
            this.#context.logger.warn(`${track.name} track failed to start`, error),
          );
        } catch (error) {
          this.#context.logger.warn(`${track.name} track failed to start`, error);
        }
      } else if (!wanted && running) {
        this.#stop(track);
      }
    }
  }

  stopAll(): void {
    for (const track of this.#tracks) if (this.#running.has(track.name)) this.#stop(track);
  }

  isRunning(name: RecordingTrack): boolean {
    return this.#running.has(name);
  }

  #stop(track: Track): void {
    this.#running.delete(track.name);
    try {
      track.stop();
    } catch (error) {
      this.#context.logger.warn(`${track.name} track failed to stop`, error);
    }
  }
}
