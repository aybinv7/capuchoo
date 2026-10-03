import type { RecorderHealth, RecordingPolicyRequest } from "@capuchoo/core";
import type { Deps } from "../http/context";
import { upsertRecorderHealth } from "../repositories/recorder-health";

const REFRESH_MS = 5 * 60_000;
const MAX_TRACKED = 20_000;

/**
 * Decides which health reports reach the database. A device asks for its policy about once a
 * minute; only a change, or the first report in five minutes, is written.
 */
export class HealthGate {
  private readonly written = new Map<string, { digest: string; at: number }>();

  due(key: string, health: RecorderHealth, now: number): boolean {
    const digest = JSON.stringify(health);
    const previous = this.written.get(key);
    if (previous && previous.digest === digest && now - previous.at < REFRESH_MS) return false;
    this.written.delete(key);
    if (this.written.size >= MAX_TRACKED) {
      const oldest = this.written.keys().next().value;
      if (oldest !== undefined) this.written.delete(oldest);
    }
    this.written.set(key, { digest, at: now });
    return true;
  }

  forget(key: string): void {
    this.written.delete(key);
  }
}

/** Keeps the latest health a device reported, and tells open dashboards when it changed. */
export function noteRecorderHealth(
  deps: Deps,
  gate: HealthGate,
  target: { appId: string; deviceUuid: string | null },
  request: RecordingPolicyRequest,
): void {
  const health = request.health;
  if (!health) return;
  const now = deps.now();
  const key = `${target.appId}:${request.deviceId}`;
  if (!gate.due(key, health, now.getTime())) return;
  upsertRecorderHealth(deps.db, {
    appId: target.appId,
    deviceId: request.deviceId,
    deviceUuid: target.deviceUuid,
    platform: request.platform,
    versionName: request.versionName,
    channel: request.channel,
    health,
    seenAt: now,
  }).then(
    () =>
      deps.hub.publish({
        type: "recorder_health",
        appId: target.appId,
        data: { device_id: request.deviceId },
      }),
    (error: unknown) => {
      gate.forget(key);
      deps.logger.warn("recorder health write failed", { error });
    },
  );
}
