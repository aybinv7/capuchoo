import { describe, expect, it, vi } from "vite-plus/test";
import type { CloudClient } from "../services/cloud.js";
import type { AppArtefacts } from "../services/wire.js";
import { UploadTimeoutError } from "../utils/http.js";
import { publishRelease, UnconfirmedUploadError } from "./publish.js";
import { confirmAfterTimeout, findPublished } from "./upload-recovery.js";
import type { UploadInput } from "./upload.js";

const EMPTY: AppArtefacts = { bundles: [], native_builds: [] };
const WITH_BUNDLE: AppArtefacts = {
  bundles: [
    {
      id: "b-120",
      version_name: "1.2.0",
      platform: "android",
      flavour: "prod",
      created_at: "2026-09-30T00:00:00Z",
    },
  ],
  native_builds: [],
};

const QUERY = {
  kind: "ota" as const,
  platform: "android",
  flavour: "prod" as const,
  version: "1.2.0",
  versionCode: 12,
};

const noSleep = { sleep: async () => {}, attempts: 3 };

describe("findPublished", () => {
  it("matches version, platform and flavour", () => {
    expect(findPublished(WITH_BUNDLE, QUERY)).toBe("b-120");
    expect(findPublished(WITH_BUNDLE, { ...QUERY, flavour: "staging" })).toBeNull();
  });

  it("matches a native build by its build number", () => {
    const artefacts: AppArtefacts = {
      bundles: [],
      native_builds: [
        {
          id: "n-12",
          version_name: "1.2.0",
          version_code: 12,
          platform: "android",
          flavour: "prod",
          created_at: "2026-09-30T00:00:00Z",
        },
      ],
    };
    expect(findPublished(artefacts, { ...QUERY, kind: "native" })).toBe("n-12");
  });
});

describe("confirmAfterTimeout", () => {
  it("finds an artefact the server finished storing after the timeout", async () => {
    const list = vi
      .fn<() => Promise<AppArtefacts>>()
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValue(WITH_BUNDLE);
    expect(await confirmAfterTimeout(list, QUERY, noSleep)).toEqual({
      kind: "published",
      id: "b-120",
    });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("concludes absent only after every attempt answered", async () => {
    const list = vi.fn(async () => EMPTY);
    expect(await confirmAfterTimeout(list, QUERY, noSleep)).toEqual({ kind: "absent" });
    expect(list).toHaveBeenCalledTimes(3);
  });

  it("is unknown when the server never answered", async () => {
    const list = vi.fn(async (): Promise<AppArtefacts> => {
      throw new Error("ECONNRESET");
    });
    expect(await confirmAfterTimeout(list, QUERY, noSleep)).toEqual({
      kind: "unknown",
      reason: "ECONNRESET",
    });
  });
});

function input(cloud: Partial<CloudClient>): UploadInput {
  return {
    cloud: cloud as CloudClient,
    artifact: { kind: "ota", filePath: "bundle.zip", byteSize: 1 },
    outcome: {
      version: "1.2.0",
      versionCode: 12,
      environment: "prod",
      artifact: null,
      nativeConfigMethod: "trapeze",
      warnings: [],
      skipped: [],
    },
    seal: { warnings: [] },
    cloudAppId: "app-1",
    appId: "com.example.app",
    channel: "prod",
    platform: "android",
    notes: "",
    active: true,
    required: false,
    allowCertChange: false,
  };
}

describe("publishRelease", () => {
  const timedOut = async () => {
    throw new UploadTimeoutError(15 * 60_000);
  };

  it("reports success with a warning when the timed-out upload landed", async () => {
    const published = await publishRelease(
      input({ uploadBundle: timedOut, artefacts: async () => WITH_BUNDLE }),
      noSleep,
    );
    expect(published.artefactId).toBe("b-120");
    expect(published.warning).toContain("the server has Bundle 1.2.0");
  });

  it("says nothing was published when the server has nothing, so the files are restored", async () => {
    const failure = await publishRelease(
      input({ uploadBundle: timedOut, artefacts: async () => EMPTY }),
      noSleep,
    ).catch((error: unknown) => error as Error);
    expect(failure.message).toContain("Nothing was published; deploy again");
    expect(failure.cause).toBeInstanceOf(UploadTimeoutError);
  });

  it("asks the server after a dropped connection, as after a timeout", async () => {
    const dropped = async () => {
      throw new TypeError("fetch failed");
    };
    const published = await publishRelease(
      input({ uploadBundle: dropped, artefacts: async () => WITH_BUNDLE }),
      noSleep,
    );
    expect(published.warning).toContain("The connection dropped during the upload");
    await expect(
      publishRelease(input({ uploadBundle: dropped, artefacts: async () => EMPTY }), noSleep),
    ).rejects.toThrow("The connection dropped during the upload, and the server does not have");
  });

  it("rethrows a refusal the server answered with", async () => {
    const refused = async () => {
      throw new Error("Version 1.2.0 is already published");
    };
    await expect(
      publishRelease(input({ uploadBundle: refused, artefacts: async () => EMPTY }), noSleep),
    ).rejects.toThrow("already published");
  });

  it("refuses to guess when the server cannot be asked", async () => {
    await expect(
      publishRelease(
        input({
          uploadBundle: timedOut,
          artefacts: async () => {
            throw new Error("offline");
          },
        }),
        noSleep,
      ),
    ).rejects.toBeInstanceOf(UnconfirmedUploadError);
  });

  it("does not query after other upload failures", async () => {
    const artefacts = vi.fn(async () => WITH_BUNDLE);
    await expect(
      publishRelease(
        input({
          uploadBundle: async () => {
            throw new Error("413");
          },
          artefacts,
        }),
        noSleep,
      ),
    ).rejects.toThrow("413");
    expect(artefacts).not.toHaveBeenCalled();
  });

  it("passes the artefact id through on success", async () => {
    const published = await publishRelease(
      input({ uploadBundle: async () => ({ status: 201, body: { id: "b-new" } }) }),
    );
    expect(published).toEqual({ artefactId: "b-new" });
  });
});
