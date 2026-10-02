import { describe, expect, it } from "vite-plus/test";
import type { GithubSetup } from "@/shared/types/ci";
import { installErrorMessage, isGithubFormAction } from "./github-messages";
import { otherSecrets, setupProgress, variableState, workflowState } from "./github-setup";

const secret = (name: GithubSetup["secrets"][number]["name"], present = false) => ({
  name,
  present,
  required: "always" as const,
});

function setup(overrides: Partial<GithubSetup> = {}): GithubSetup {
  return {
    default_branch: "main",
    workflow: {
      path: ".github/workflows/capuchoo.yml",
      exists: false,
      generated: false,
      version: null,
      html_url: null,
    },
    pull_request: null,
    secrets: [
      secret("CAPUCHOO_API_KEY"),
      secret("CAPUCHOO_SIGNING_KEY"),
      secret("ANDROID_KEYSTORE_BASE64"),
      secret("ANDROID_KEYSTORE_PASSWORD"),
      secret("ANDROID_KEY_ALIAS"),
      secret("ANDROID_KEY_PASSWORD"),
    ],
    variable: { name: "CAPUCHOO_ENDPOINT", value: null, expected: "https://updates.example.com" },
    package_manager: "pnpm",
    ...overrides,
  };
}

describe("workflowState", () => {
  it("follows the file from missing to proposed to in place", () => {
    expect(workflowState(setup())).toEqual({ kind: "missing" });
    expect(
      workflowState(
        setup({
          pull_request: { number: 7, html_url: "https://github.com/o/r/pull/7", state: "open" },
        }),
      ),
    ).toEqual({ kind: "pull-request", number: 7, url: "https://github.com/o/r/pull/7" });
    const exists = { ...setup().workflow, exists: true, generated: true, version: "0.9.0" };
    expect(workflowState(setup({ workflow: exists }))).toMatchObject({ kind: "ready" });
  });

  it("flags a hand-written workflow and an outdated generated one", () => {
    const base = setup().workflow;
    expect(workflowState(setup({ workflow: { ...base, exists: true } }))).toMatchObject({
      kind: "foreign",
    });
    expect(
      workflowState(
        setup({
          workflow: {
            ...base,
            exists: true,
            generated: true,
            version: "0.8.0",
            expected_version: "0.9.0",
          },
        }),
      ),
    ).toMatchObject({ kind: "outdated", version: "0.8.0", expected: "0.9.0" });
  });

  it("ignores a closed pull request", () => {
    expect(
      workflowState(setup({ pull_request: { number: 7, html_url: "x", state: "closed" } })),
    ).toEqual({ kind: "missing" });
  });
});

describe("variableState", () => {
  it("compares the endpoint ignoring a trailing slash", () => {
    expect(variableState(setup()).kind).toBe("missing");
    const value = (v: string) =>
      setup({
        variable: { name: "CAPUCHOO_ENDPOINT", value: v, expected: "https://updates.example.com" },
      });
    expect(variableState(value("https://updates.example.com/")).kind).toBe("set");
    expect(variableState(value("http://localhost:3000")).kind).toBe("wrong");
  });
});

describe("setupProgress", () => {
  it("counts the three required steps and treats Android signing as optional", () => {
    expect(setupProgress(setup())).toMatchObject({
      workflow: "todo",
      apiKey: "todo",
      endpoint: "todo",
      android: "optional",
      done: 0,
      total: 3,
    });
  });

  it("marks a half-configured keystore for attention", () => {
    const secrets = setup().secrets.map((entry) =>
      entry.name === "ANDROID_KEY_ALIAS" || entry.name === "CAPUCHOO_API_KEY"
        ? { ...entry, present: true }
        : entry,
    );
    expect(setupProgress(setup({ secrets }))).toMatchObject({
      android: "attention",
      apiKey: "done",
      done: 1,
    });
  });

  it("lists the secrets no step manages", () => {
    expect(otherSecrets(setup()).map((entry) => entry.name)).toEqual(["CAPUCHOO_SIGNING_KEY"]);
  });
});

describe("github messages", () => {
  it("explains known install errors and falls back for unknown ones", () => {
    expect(installErrorMessage("not_yours")).toMatch(/cannot see that installation/);
    expect(installErrorMessage("weird")).toMatch(/weird/);
  });

  it("only posts the manifest to github.com over https", () => {
    expect(isGithubFormAction("https://github.com/settings/apps/new?state=x")).toBe(true);
    expect(isGithubFormAction("https://github.com/organizations/acme/settings/apps/new")).toBe(
      true,
    );
    expect(isGithubFormAction("http://github.com/settings/apps/new")).toBe(false);
    expect(isGithubFormAction("https://evil.example/github.com")).toBe(false);
    expect(isGithubFormAction("not a url")).toBe(false);
  });
});
