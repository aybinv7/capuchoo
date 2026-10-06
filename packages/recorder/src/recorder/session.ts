import type {
  RecordingDeviceFacts,
  RecordingMode,
  RecordingSessionMeta,
  RecordingStart,
} from "@capuchoo/core";
import { measureSafeArea } from "./safeArea.js";
import type { RecorderIdentity } from "./types.js";

export const RECORDER_VERSION = "0.1.2";

function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A lowercase v4 uuid; `randomUUID` is missing outside a secure context. */
export function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = randomHex(32);
  const variant = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function deviceFacts(identity: RecorderIdentity): RecordingDeviceFacts {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const webview =
    /Chrome\/([\d.]+)/.exec(agent)?.[1] ?? /Version\/([\d.]+)/.exec(agent)?.[1] ?? null;
  const screen =
    typeof window === "undefined"
      ? null
      : {
          width: Math.round(window.innerWidth),
          height: Math.round(window.innerHeight),
          dpr: window.devicePixelRatio || 1,
        };
  return {
    model: identity.device?.model ?? null,
    manufacturer: identity.device?.manufacturer ?? null,
    osVersion: identity.device?.osVersion ?? null,
    webview: identity.device?.webview ?? webview,
    screen: identity.device?.screen ?? screen,
    safeArea: measureSafeArea(),
  };
}

export function sessionMeta(input: {
  sessionId: string;
  identity: RecorderIdentity;
  mode: RecordingMode;
  start: RecordingStart;
  startedAt: number;
  note: string | null;
}): RecordingSessionMeta {
  const { identity } = input;
  return {
    sessionId: input.sessionId,
    appId: identity.appId,
    deviceId: identity.deviceId,
    platform: identity.platform,
    versionName: identity.versionName,
    versionCode: identity.versionCode,
    channel: identity.channel,
    start: input.start,
    mode: input.mode,
    startedAt: input.startedAt,
    recorder: RECORDER_VERSION,
    device: deviceFacts(identity),
    note: input.note,
  };
}

/** The server origin, whatever form the app configured it in. */
export function normaliseEndpoint(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
}
