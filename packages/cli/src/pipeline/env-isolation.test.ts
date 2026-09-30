import { normaliseProjectConfig, type ProjectConfig } from "@capuchoo/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { validateRequest, type DeployRequest } from "./deploy.js";
import {
  describeEnvIsolationProblems,
  findLeakedKeys,
  missingRequiredKeys,
  readLocalEnvSources,
} from "./env-isolation.js";
import { buildEnvironment, resolveFlavour } from "./flavour.js";

const FLAVOUR = [
  "VITE_APP_ID=com.example.app",
  "VITE_UPDATE_API_URL=https://updates.example.com",
  "VITE_API_URL=https://api.example.com",
].join("\n");

let appDir: string;

function write(relative: string, contents: string): void {
  const file = path.join(appDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function project(overrides: Partial<ProjectConfig> = {}) {
  return normaliseProjectConfig({
    appId: "com.example.app",
    cloudAppId: "app-1",
    appName: "Example",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  });
}

function request(overrides: Partial<DeployRequest> = {}): DeployRequest {
  return {
    appDir,
    project: project(),
    kind: "ota",
    platform: "android",
    channel: "prod",
    environment: "prod",
    version: "1.0.0",
    buildType: "release",
    skipAssets: true,
    skipBuild: false,
    allowUnsigned: false,
    dryRun: true,
    verbose: false,
    quiet: true,
    ...overrides,
  };
}

function problems(overrides: Partial<DeployRequest> = {}): string[] {
  const deploy = request(overrides);
  return validateRequest(deploy, resolveFlavour(appDir, deploy.project, "prod"));
}

beforeEach(() => {
  appDir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-env-"));
  write("build/prod/.env.prod", FLAVOUR);
});

afterEach(() => {
  fs.rmSync(appDir, { recursive: true, force: true });
});

describe("local env leaks", () => {
  it("refuses VITE_* keys a local file sets and the flavour omits, naming each file", () => {
    write(".env", "VITE_DB_FILENAME=prod.db\nVITE_API_URL=http://localhost\n");
    write(".env.local", "VITE_LIVE_RELOAD=true\nVITE_DB_FILENAME=laptop.db\nSECRET=x\n");

    const found = problems();

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("VITE_DB_FILENAME (.env, .env.local)");
    expect(found[0]).toContain("--allow-local-env");
    expect(found[0]).not.toContain("VITE_API_URL");
    expect(found[0]).not.toContain("VITE_LIVE_RELOAD");
    expect(found[0]).not.toContain("SECRET");
  });

  it("includes the mode-specific files Vite also loads", () => {
    write(".env.prod.local", "VITE_FEATURE=on\n");
    expect(problems()[0]).toContain("VITE_FEATURE (.env.prod.local)");
  });

  it("accepts the local values with --allow-local-env", () => {
    write(".env.local", "VITE_DB_FILENAME=laptop.db\n");
    expect(problems({ allowLocalEnv: true })).toEqual([]);
  });

  it("never reports the flavour file against itself", () => {
    const deploy = request({
      project: project({ flavours: { prod: { envFile: ".env.prod" } } }),
    });
    write(".env.prod", FLAVOUR);
    expect(validateRequest(deploy, resolveFlavour(appDir, deploy.project, "prod"))).toEqual([]);
  });

  it("also reads the build directory when project.json builds elsewhere", () => {
    write("web/.env.local", "VITE_FROM_BUILD_DIR=1\n");
    const deploy = request({ project: project({ build: { cwd: "web" } }) });
    const found = validateRequest(deploy, resolveFlavour(appDir, deploy.project, "prod"));
    expect(found[0]).toContain(`VITE_FROM_BUILD_DIR (${path.join("web", ".env.local")})`);
  });
});

describe("requiredEnv", () => {
  it("refuses a flavour that omits or empties a required key", () => {
    write("build/prod/.env.prod", `${FLAVOUR}\nVITE_DB_FILENAME=\n`);
    const found = problems({
      project: project({ requiredEnv: ["VITE_DB_FILENAME", "VITE_TENANT", "VITE_API_URL"] }),
    });
    expect(found).toEqual([
      "build/prod/.env.prod does not set VITE_DB_FILENAME, VITE_TENANT, which project.json lists in requiredEnv",
    ]);
  });

  it("is not waived by --allow-local-env", () => {
    const found = problems({
      allowLocalEnv: true,
      project: project({ requiredEnv: ["VITE_TENANT"] }),
    });
    expect(found).toHaveLength(1);
  });
});

describe("pure helpers", () => {
  it("findLeakedKeys ignores keys the CLI passes itself", () => {
    const leaked = findLeakedKeys({}, [
      { label: ".env", keys: ["VITE_APP_VERSION", "VITE_LIVE_RELOAD", "VITE_X"] },
    ]);
    expect(leaked).toEqual([{ key: "VITE_X", files: [".env"] }]);
  });

  it("missingRequiredKeys keeps declaration order", () => {
    expect(missingRequiredKeys(["B", "A"], { C: "1" })).toEqual(["B", "A"]);
  });

  it("describeEnvIsolationProblems is empty for an isolated flavour", () => {
    expect(
      describeEnvIsolationProblems({
        envFileLabel: "f",
        required: [],
        flavourEnv: { VITE_X: "1" },
        sources: [{ label: ".env", keys: ["VITE_X"] }],
        allowLocalEnv: false,
      }),
    ).toEqual([]);
  });

  it("readLocalEnvSources lists keys only for the files that exist", () => {
    write(".env", "VITE_A=1\n");
    const flavour = resolveFlavour(appDir, project(), "prod");
    expect(readLocalEnvSources([appDir], flavour)).toEqual([{ label: ".env", keys: ["VITE_A"] }]);
  });
});

describe("buildEnvironment", () => {
  it("passes every flavour key and forces live reload off", () => {
    write("build/prod/.env.prod", `${FLAVOUR}\nVITE_LIVE_RELOAD=true\n`);
    const flavour = resolveFlavour(appDir, project(), "prod");
    const env = buildEnvironment(flavour, {
      version: "1.2.3",
      versionCode: 7,
      codes: { dev: 1, staging: 1, prod: 7 },
    });
    expect(env).toMatchObject({
      VITE_APP_ID: "com.example.app",
      VITE_API_URL: "https://api.example.com",
      VITE_APP_VERSION: "1.2.3",
      VITE_LIVE_RELOAD: "false",
    });
  });
});
