import {
  GITHUB_WORKFLOW_SECRETS,
  GITHUB_WORKFLOW_VARIABLE,
  renderGithubWorkflow,
} from "@capuchoo/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parseClients } from "./clients.js";
import { githubNextSteps, resolveGithubTarget, type GithubTargetInput } from "./github-target.js";

describe("resolveGithubTarget", () => {
  let dir: string;
  let app: string;

  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-github-")));
    app = path.join(dir, "apps", "shop");
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(path.join(dir, ".git"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const input = (overrides: Partial<GithubTargetInput> = {}): GithubTargetInput => ({
    cwd: app,
    cliVersion: "0.16.0",
    clients: parseClients("acme"),
    devBranch: "dev",
    stagingBranch: "staging",
    ...overrides,
  });

  it("writes core's workflow at the repository root, for the app below it", async () => {
    const detect = vi.fn(async () => "trunk");
    const target = await resolveGithubTarget(input(), detect);

    expect(detect).toHaveBeenCalledWith(dir);
    expect(target.file).toBe(path.join(dir, ".github", "workflows", "capuchoo.yml"));
    expect(target.contents).toBe(
      renderGithubWorkflow({
        cliVersion: "0.16.0",
        appDir: "apps/shop",
        defaultBranch: "trunk",
        devBranch: "dev",
        stagingBranch: "staging",
        clients: ["acme"],
      }),
    );
    expect(target.details).toMatchObject({
      appDir: "apps/shop",
      defaultBranch: "trunk",
      defaultBranchSource: "origin",
    });
    expect(target.warnings).toEqual([]);
  });

  it("uses the flags over detection", async () => {
    const detect = vi.fn(async () => "trunk");
    const target = await resolveGithubTarget(
      input({ defaultBranch: "master", appDir: "mobile\\shop" }),
      detect,
    );
    expect(detect).not.toHaveBeenCalled();
    expect(target.contents).toContain('APP_DIR: "mobile/shop"');
    expect(target.details).toMatchObject({ defaultBranch: "master", defaultBranchSource: "flag" });
  });

  it("falls back to main, and says so, when origin/HEAD is unknown", async () => {
    const target = await resolveGithubTarget(input(), async () => null);
    expect(target.details).toMatchObject({
      defaultBranch: "main",
      defaultBranchSource: "fallback",
    });
    expect(target.warnings.join("\n")).toContain("--default-branch");
  });

  it("treats the directory as the root outside a repository", async () => {
    fs.rmSync(path.join(dir, ".git"), { recursive: true });
    const detect = vi.fn(async () => "trunk");
    const target = await resolveGithubTarget(input({ cwd: dir }), detect);
    expect(detect).not.toHaveBeenCalled();
    expect(target.contents).toContain('APP_DIR: "."');
    expect(target.warnings.join("\n")).toContain("No git repository");
  });

  it("warns when the file will not run or the dashboard will not find it", async () => {
    const elsewhere = await resolveGithubTarget(input({ output: "ci.yml" }), async () => "main");
    expect(elsewhere.file).toBe(path.join(app, "ci.yml"));
    expect(elsewhere.warnings.join("\n")).toContain("will not run");

    const renamed = await resolveGithubTarget(
      input({ output: "../../.github/workflows/release.yml" }),
      async () => "main",
    );
    expect(renamed.warnings.join("\n")).toContain("workflow path");
  });

  it("surfaces core's refusal of an unsafe option", async () => {
    await expect(
      resolveGithubTarget(input({ devBranch: "main" }), async () => "main"),
    ).rejects.toThrow("three different branches");
    await expect(
      resolveGithubTarget(input({ appDir: "../outside" }), async () => "main"),
    ).rejects.toThrow("appDir");
  });
});

describe("githubNextSteps", () => {
  it("names every secret, the variable and the dashboard", () => {
    const text = githubNextSteps(parseClients("acme")).join("\n");
    for (const name of [...GITHUB_WORKFLOW_SECRETS, GITHUB_WORKFLOW_VARIABLE]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("App settings > CI");
    expect(text).toContain("capuchoo channel create prod-acme --client --base prod");
  });
});
