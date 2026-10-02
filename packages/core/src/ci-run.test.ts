import { describe, expect, it } from "vite-plus/test";
import {
  describeCiRun,
  githubDispatchInputs,
  gitlabPipelineVariables,
  parseCiRunRequest,
} from "./ci-run.js";

describe("parseCiRunRequest", () => {
  it("defaults to an OTA release build", () => {
    const result = parseCiRunRequest({ ref: "staging" });
    expect(result).toEqual({
      ok: true,
      request: {
        action: "ota",
        ref: "staging",
        channel: null,
        version: null,
        client: null,
        notes: null,
        buildType: "release",
      },
    });
  });

  it.each([
    [{ ref: "main; rm -rf /" }, "ref"],
    [{ ref: "../etc" }, "ref"],
    [{ ref: "main", action: "drop" }, "action"],
    [{ ref: "main", channel: "Prod Channel" }, "channel"],
    [{ ref: "main", version: "latest" }, "version"],
    [{ ref: "main", action: "deliver", version: "1.0.0" }, "client"],
    [{ ref: "main", action: "deliver", client: "acme", version: "auto" }, "version"],
    [{ ref: "main", build_type: "profile" }, "buildType"],
  ])("refuses %j on %s", (input, field) => {
    const result = parseCiRunRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });

  it("accepts a client given as its channel name", () => {
    const result = parseCiRunRequest({
      ref: "v1.2.0",
      action: "deliver",
      client: "prod-acme",
      version: "1.2.0",
    });
    expect(result.ok && result.request.client).toBe("acme");
  });
});

describe("provider inputs", () => {
  const parsed = parseCiRunRequest({
    ref: "dev",
    action: "native",
    channel: "dev",
    version: "auto",
    notes: "  hello  ",
    build_type: "debug",
  });
  if (!parsed.ok) throw new Error("fixture");

  it("names the workflow inputs and the pipeline variables from one request", () => {
    expect(githubDispatchInputs(parsed.request)).toEqual({
      action: "native",
      channel: "dev",
      version: "auto",
      notes: "hello",
      build_type: "debug",
    });
    expect(gitlabPipelineVariables(parsed.request)).toEqual({
      CAPUCHOO_ACTION: "native",
      CAPUCHOO_CHANNEL: "dev",
      CAPUCHOO_VERSION: "auto",
      CAPUCHOO_NOTES: "hello",
      CAPUCHOO_BUILD_TYPE: "debug",
    });
  });

  it("keeps GitLab from expanding a variable named in the notes", () => {
    const notes = parseCiRunRequest({ ref: "dev", notes: "cost $5 not $CAPUCHOO_API_KEY" });
    if (!notes.ok) throw new Error("fixture");
    expect(gitlabPipelineVariables(notes.request).CAPUCHOO_NOTES).toBe(
      "cost $$5 not $$CAPUCHOO_API_KEY",
    );
    expect(githubDispatchInputs(notes.request).notes).toBe("cost $5 not $CAPUCHOO_API_KEY");
  });

  it("describes the run", () => {
    expect(describeCiRun(parsed.request)).toBe("Build native to dev @ auto");
  });
});
