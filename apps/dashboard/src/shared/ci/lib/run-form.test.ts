import { describe, expect, it } from "vite-plus/test";
import {
  channelForRef,
  createRunForm,
  describeRunForm,
  toRunInput,
  validateRunForm,
  versionFromRef,
  type RunContext,
  type RunForm,
} from "./run-form";

const CONTEXT: RunContext = {
  defaultBranch: "main",
  tags: ["v1.4.2"],
  channels: [
    { name: "dev", environment: "dev", kind: "release" },
    { name: "staging", environment: "staging", kind: "release" },
    { name: "prod", environment: "prod", kind: "release" },
    { name: "prod-acme", environment: "prod", kind: "client" },
  ],
};

const form = (overrides: Partial<RunForm> = {}): RunForm => ({
  ...createRunForm({}, "main"),
  ...overrides,
});

describe("createRunForm", () => {
  it("defaults to an OTA on the default branch with the channel derived", () => {
    expect(createRunForm({}, "main")).toMatchObject({
      action: "ota",
      ref: "main",
      channel: "",
      versionMode: "ref",
    });
  });

  it("turns a client preset into a delivery with an exact version", () => {
    expect(createRunForm({ client: "prod-acme" })).toMatchObject({
      action: "deliver",
      client: "prod-acme",
      versionMode: "exact",
    });
  });
});

describe("versionFromRef", () => {
  it("reads a version only from a tag shaped like one", () => {
    expect(versionFromRef("v1.4.2", ["v1.4.2"])).toBe("v1.4.2");
    expect(versionFromRef("2.0.0-rc.1", ["2.0.0-rc.1"])).toBe("2.0.0-rc.1");
    expect(versionFromRef("v1.4.2", [])).toBeNull();
    expect(versionFromRef("release-1", ["release-1"])).toBeNull();
  });
});

describe("toRunInput", () => {
  it("sends null for a derived channel and the ref's default version", () => {
    expect(toRunInput(form())).toMatchObject({ channel: null, version: null, client: null });
  });

  it("maps the version modes", () => {
    expect(toRunInput(form({ versionMode: "auto", version: "9.9.9" })).version).toBe("auto");
    expect(toRunInput(form({ versionMode: "exact", version: " 1.2.3 " })).version).toBe("1.2.3");
  });

  it("drops the channel for a delivery and the client for anything else", () => {
    expect(
      toRunInput(form({ action: "deliver", channel: "staging", client: "prod-acme" })),
    ).toMatchObject({ channel: null, client: "prod-acme" });
    expect(toRunInput(form({ client: "acme" })).client).toBeNull();
  });

  it("sends the build type under its wire name", () => {
    expect(toRunInput(form({ action: "native", buildType: "debug" })).build_type).toBe("debug");
  });
});

describe("validateRunForm", () => {
  it("accepts a plain run and returns core's request", () => {
    expect(validateRunForm(form({ channel: "staging" }))).toEqual({
      ok: true,
      request: {
        action: "ota",
        ref: "main",
        channel: "staging",
        version: null,
        client: null,
        notes: null,
        buildType: "release",
      },
    });
  });

  it("puts each refusal on the field that caused it", () => {
    expect(validateRunForm(form({ ref: "" }))).toMatchObject({ ok: false, field: "ref" });
    expect(validateRunForm(form({ ref: "a..b" }))).toMatchObject({ ok: false, field: "ref" });
    expect(validateRunForm(form({ channel: "Bad Name" }))).toMatchObject({
      ok: false,
      field: "channel",
    });
    expect(validateRunForm(form({ versionMode: "exact", version: "one" }))).toMatchObject({
      ok: false,
      field: "version",
    });
  });

  it("asks for a version when exact is chosen but left empty", () => {
    expect(validateRunForm(form({ versionMode: "exact", version: "" }))).toMatchObject({
      ok: false,
      field: "version",
    });
  });

  it("requires a client and an exact version to deliver", () => {
    const deliver = form({ action: "deliver", versionMode: "exact", version: "1.4.2" });
    expect(validateRunForm(deliver)).toMatchObject({ ok: false, field: "client" });
    expect(validateRunForm({ ...deliver, client: "prod-acme" })).toMatchObject({
      ok: true,
      request: { action: "deliver", client: "acme", version: "1.4.2", channel: null },
    });
    expect(validateRunForm({ ...deliver, client: "acme", version: "auto" })).toMatchObject({
      ok: false,
      field: "version",
      message: expect.stringContaining("not auto"),
    });
  });

  it("describes a valid run the way the server titles it", () => {
    expect(describeRunForm(form({ action: "native", channel: "dev", buildType: "debug" }))).toBe(
      "Build native to dev",
    );
    expect(describeRunForm(form({ ref: "" }))).toBeNull();
  });
});

describe("channelForRef", () => {
  it("names the channel the workflow would derive, when the app has it", () => {
    expect(channelForRef("v1.4.2", CONTEXT)).toBe("prod");
    expect(channelForRef("main", CONTEXT)).toBe("prod");
    expect(channelForRef("staging", CONTEXT)).toBe("staging");
    expect(channelForRef("dev", CONTEXT)).toBe("dev");
    expect(channelForRef("feature/x", CONTEXT)).toBeNull();
    expect(channelForRef("dev", { ...CONTEXT, channels: [] })).toBeNull();
  });
});

describe("validateRunForm with the workflow's prod rule", () => {
  it("refuses auto on prod, explicit or derived", () => {
    expect(validateRunForm(form({ channel: "prod", versionMode: "auto" }), CONTEXT)).toMatchObject({
      ok: false,
      field: "version",
    });
    expect(validateRunForm(form({ ref: "main" }), CONTEXT)).toMatchObject({
      ok: false,
      field: "version",
    });
  });

  it("accepts a tag or an exact version on prod, and anything for a rehearsal", () => {
    expect(validateRunForm(form({ ref: "v1.4.2", channel: "prod" }), CONTEXT).ok).toBe(true);
    expect(
      validateRunForm(form({ channel: "prod", versionMode: "exact", version: "1.5.0" }), CONTEXT)
        .ok,
    ).toBe(true);
    expect(validateRunForm(form({ action: "check", channel: "prod" }), CONTEXT).ok).toBe(true);
    expect(validateRunForm(form({ channel: "staging", versionMode: "auto" }), CONTEXT).ok).toBe(
      true,
    );
  });
});
