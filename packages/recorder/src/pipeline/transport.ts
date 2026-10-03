import {
  RECORDING_ASSET_HEADER,
  RECORDING_HEADER,
  encodeRecordingHeader,
  type RecordingAssetHeader,
  type RecordingSegmentMeta,
  type RecordingSessionMeta,
} from "@capuchoo/core";

/** `drop` is a refusal that a retry cannot change; `retry` is anything a later attempt might fix. */
export type SendOutcome = "ok" | "retry" | "drop";

export interface Transport {
  sendSegment(
    session: RecordingSessionMeta,
    segment: RecordingSegmentMeta,
    bytes: Uint8Array,
  ): Promise<SendOutcome>;
  sendAsset(asset: RecordingAssetHeader, bytes: Uint8Array): Promise<SendOutcome>;
}

const TIMEOUT_MS = 30_000;

function classify(status: number): SendOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "drop";
}

async function post(url: string, headers: Record<string, string>, body: Uint8Array) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body as BodyInit,
      signal: controller.signal,
      credentials: "omit",
    });
    void response.body?.cancel();
    return classify(response.status);
  } catch {
    return "retry";
  } finally {
    clearTimeout(timer);
  }
}

export function createHttpTransport(getEndpoint: () => string): Transport {
  return {
    sendSegment(session, segment, bytes) {
      return post(
        `${getEndpoint()}/api/recording/segments`,
        {
          "content-type": "application/octet-stream",
          [RECORDING_HEADER]: encodeRecordingHeader({ session, segment }),
        },
        bytes,
      );
    },
    sendAsset(asset, bytes) {
      return post(
        `${getEndpoint()}/api/recording/assets`,
        {
          "content-type": "application/octet-stream",
          [RECORDING_ASSET_HEADER]: encodeRecordingHeader(asset),
        },
        bytes,
      );
    },
  };
}
