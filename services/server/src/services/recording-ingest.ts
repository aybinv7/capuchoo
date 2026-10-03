import { randomUUID } from "node:crypto";
import type { RecordingAssetHeader, RecordingSegmentHeader } from "@capuchoo/core";
import type { Deps } from "../http/context";
import type { MeasuredStream } from "../http/multipart";
import { conflict } from "../lib/errors";
import { findAppByBundleId } from "../repositories/apps";
import { findDevice } from "../repositories/devices";
import { hasAsset, insertAsset } from "../repositories/recording-assets";
import { ensureSession, recordSegment } from "../repositories/recording-sessions";

export type SegmentOutcome =
  | { status: "unknown_app" }
  | { status: "stored" | "duplicate"; sessionId: string };

export type AssetOutcome = { status: "unknown_app" } | { status: "stored" | "duplicate" };

function cachedIdentity(deps: Deps, bundleId: string) {
  return deps.cache.get("identity", bundleId, () => findAppByBundleId(deps.db, bundleId));
}

/** Stores one segment body untouched and records it; safe to retry with the same `seq`. */
export async function ingestSegment(
  deps: Deps,
  header: RecordingSegmentHeader,
  body: MeasuredStream,
): Promise<SegmentOutcome> {
  const identity = await cachedIdentity(deps, header.session.appId);
  if (!identity) {
    body.stream.resume();
    return { status: "unknown_app" };
  }
  const appId = identity.app.id;
  const device = await findDevice(deps.db, appId, header.session.deviceId);
  const session = await ensureSession(deps.db, {
    appId,
    deviceUuid: device?.id ?? null,
    meta: header.session,
  });
  if (session.device_id !== header.session.deviceId) {
    body.stream.resume();
    throw conflict("That recording belongs to another device", "session_owner");
  }

  const key = `recordings/${appId}/${header.session.sessionId}/${header.segment.seq}.ndjson.gz`;
  const sizeBytes = await deps.storage.put(key, body.stream, "application/gzip");
  const stored = await recordSegment(deps.db, {
    sessionId: session.id,
    meta: header.segment,
    storageKey: key,
    sizeBytes,
    now: deps.now(),
    origin: {
      appId,
      deviceId: header.session.deviceId,
      versionName: header.session.versionName,
    },
  });

  if (stored) {
    deps.hub.publish({
      type: "recording",
      appId,
      data: {
        session_id: session.id,
        device_uuid: session.device_uuid,
        seq: header.segment.seq,
        final: header.segment.final,
        errors: header.segment.errors,
        ended_at: new Date(header.segment.endedAt).toISOString(),
      },
    });
  }
  return { status: stored ? "stored" : "duplicate", sessionId: session.id };
}

/** Stores a stylesheet, font or image a replay needs, once per app, version and path. */
export async function ingestAsset(
  deps: Deps,
  header: RecordingAssetHeader,
  body: MeasuredStream,
): Promise<AssetOutcome> {
  const identity = await cachedIdentity(deps, header.appId);
  if (!identity) {
    body.stream.resume();
    return { status: "unknown_app" };
  }
  const appId = identity.app.id;
  if (await hasAsset(deps.db, appId, header.versionName, header.path)) {
    body.stream.resume();
    return { status: "duplicate" };
  }
  const key = `recordings/${appId}/assets/${randomUUID()}`;
  const sizeBytes = await deps.storage.put(key, body.stream, header.contentType);
  if (body.digest().sha256 !== header.sha256) {
    await deps.storage.delete(key);
    throw conflict("The asset does not match its declared hash", "hash_mismatch");
  }
  const inserted = await insertAsset(deps.db, {
    appId,
    versionName: header.versionName,
    path: header.path,
    sha256: header.sha256,
    contentType: header.contentType,
    storageKey: key,
    sizeBytes,
  });
  if (!inserted) await deps.storage.delete(key);
  else deps.cache.invalidate(`app:${appId}`);
  return { status: inserted ? "stored" : "duplicate" };
}
