import type {
  RecordingAsset,
  RecordingRule,
  RecordingSegment,
  RecordingSession,
} from "../db/schema";

/** A session is live while segments keep arriving and the device has not sent its last one. */
export const LIVE_WINDOW_MS = 20_000;

export function serializeRecordingSession(session: RecordingSession, now: Date) {
  return {
    id: session.id,
    session_key: session.session_key,
    device_uuid: session.device_uuid,
    device_id: session.device_id,
    platform: session.platform,
    version_name: session.version_name,
    version_code: session.version_code,
    channel: session.channel,
    start: session.start,
    mode: session.mode,
    note: session.note,
    device: session.device,
    recorder: session.recorder,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_ms: session.ended_at.getTime() - session.started_at.getTime(),
    segment_count: session.segment_count,
    event_count: Number(session.event_count),
    size_bytes: Number(session.size_bytes),
    error_count: session.error_count,
    finished: session.finished,
    last_segment_at: session.last_segment_at,
    live: !session.finished && now.getTime() - session.last_segment_at.getTime() < LIVE_WINDOW_MS,
  };
}

export function serializeRecordingSegment(segment: RecordingSegment) {
  return {
    seq: segment.seq,
    size_bytes: segment.size_bytes,
    raw_bytes: segment.raw_bytes,
    events: segment.events,
    errors: segment.errors,
    full_snapshot: segment.full_snapshot,
    started_at: segment.started_at,
    ended_at: segment.ended_at,
  };
}

export function serializeRecordingAsset(asset: RecordingAsset) {
  return {
    id: asset.id,
    path: asset.path,
    content_type: asset.content_type,
    sha256: asset.sha256,
    size_bytes: asset.size_bytes,
  };
}

export function serializeRecordingRule(rule: RecordingRule) {
  return {
    id: rule.id,
    scope: rule.scope,
    channel_id: rule.channel_id,
    device_uuid: rule.device_uuid,
    policy: rule.policy,
    live_until: rule.live_until,
    updated_by: rule.updated_by,
    updated_at: rule.updated_at,
  };
}
