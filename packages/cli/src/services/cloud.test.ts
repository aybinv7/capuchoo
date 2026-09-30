import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "../utils/http.js";
import { CloudClient } from "./cloud.js";

interface Captured {
  method: string;
  url: string;
  body: unknown;
}

let calls: Captured[];
let dir: string;
let apk: string;

function respond(status: number, body: unknown) {
  return vi.fn(async (url: string, init: { method: string; body?: unknown }) => {
    const body_ =
      init.body instanceof FormData
        ? Object.fromEntries([...init.body.entries()].filter(([, v]) => typeof v === "string"))
        : typeof init.body === "string"
          ? JSON.parse(init.body)
          : undefined;
    calls.push({ method: init.method, url: String(url), body: body_ });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

const cloud = () => new CloudClient("https://api.test", "key", { onWaking: () => {} });

beforeEach(() => {
  calls = [];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-cloud-"));
  apk = path.join(dir, "app-release.apk");
  fs.writeFileSync(apk, "apk");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

const NATIVE = {
  appId: "com.example.app",
  channel: "prod",
  platform: "android",
  versionName: "1.2.0",
  versionCode: 12,
  releaseNotes: "",
  active: true,
  required: false,
  flavour: "prod",
};

describe("native upload", () => {
  it("sends the signing certificate, signature and build id", async () => {
    vi.stubGlobal("fetch", respond(201, { id: "n1" }));

    await cloud().uploadNative({
      ...NATIVE,
      filePath: apk,
      signingCertSha256: "a".repeat(64),
      signature: "sig",
      buildId: "b1",
    });

    expect(calls[0]!.url).toBe("https://api.test/api/admin/native-upload");
    expect(calls[0]!.body).toMatchObject({
      signing_cert_sha256: "a".repeat(64),
      signature: "sig",
      build_id: "b1",
      flavour: "prod",
      version_code: "12",
    });
    expect(calls[0]!.body).not.toHaveProperty("allow_cert_change");
  });

  it("sends allow_cert_change only when asked", async () => {
    vi.stubGlobal("fetch", respond(201, {}));
    await cloud().uploadNative({ ...NATIVE, filePath: apk, allowCertChange: true });
    expect(calls[0]!.body).toMatchObject({ allow_cert_change: "true" });
  });
});

describe("artefacts", () => {
  it("fills missing lists so callers never branch on undefined", async () => {
    vi.stubGlobal("fetch", respond(200, { bundles: [{ id: "b" }] }));
    expect(await cloud().artefacts("app")).toEqual({ bundles: [{ id: "b" }], native_builds: [] });
    expect(calls[0]!.url).toBe("https://api.test/api/apps/app/artefacts");
  });
});

describe("server refusals", () => {
  it("keeps the message and exposes the refusal code", async () => {
    vi.stubGlobal(
      "fetch",
      respond(409, {
        error: 'Bundle 1.2.0 has never been served by the release channel "prod-acme" follows.',
        reason: "not-on-base",
      }),
    );

    const error = await cloud()
      .pointChannel("c1", { bundle_id: "b1" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).reason).toBe("not-on-base");
    expect((error as HttpError).message).toContain("never been served");
    expect((error as HttpError).message).not.toContain("not-on-base");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.test/api/channels/c1/point",
      body: { bundle_id: "b1" },
    });
  });

  it("appends a prose reason to a category error", async () => {
    vi.stubGlobal("fetch", respond(422, { error: "Refused", reason: "The channel is paused." }));
    const error = (await cloud()
      .pauseChannel("c1")
      .catch((caught: unknown) => caught)) as HttpError;
    expect(error.message).toBe("Refused: The channel is paused.");
    expect(error.reason).toBeNull();
  });
});
