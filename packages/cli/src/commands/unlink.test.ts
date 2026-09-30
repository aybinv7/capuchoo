import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import Unlink from "./unlink.js";

const CLI_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const PROJECT = {
  appId: "com.company.app",
  cloudAppId: "7b0c2d4e-0000-4000-8000-000000000001",
  flavours: {
    dev: { envFile: "build/dev/.env.dev" },
    prod: { envFile: "build/prod/.env.prod" },
  },
};

const ENV = (environment: string) =>
  [
    "VITE_APP_ID=com.company.app",
    `VITE_ENVIRONMENT=${environment}`,
    "",
    "# Capuchoo. Both are required: capuchooUpdaterConfig() refuses to build a",
    "# plugin block without them, and an empty updateUrl disables updates silently.",
    "VITE_UPDATE_API_URL=http://localhost:3000",
    `VITE_UPDATE_CHANNEL=${environment}`,
    "VITE_UPDATE_OTA_INSTALL=background",
    "",
  ].join("\n");

describe("capuchoo unlink", () => {
  let dir: string;
  let previous: string;

  beforeEach(() => {
    previous = process.cwd();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-unlink-"));
    fs.mkdirSync(path.join(dir, ".capuchoo"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".capuchoo/project.json"), JSON.stringify(PROJECT));
    fs.writeFileSync(path.join(dir, ".capuchoo/signing-key.pem"), "key");
    for (const environment of ["dev", "prod"]) {
      fs.mkdirSync(path.join(dir, `build/${environment}`), { recursive: true });
      fs.writeFileSync(
        path.join(dir, `build/${environment}/.env.${environment}`),
        ENV(environment),
      );
    }
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previous);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("changes nothing on a dry run", async () => {
    await Unlink.run(["--dry-run"], CLI_ROOT);
    expect(fs.existsSync(path.join(dir, ".capuchoo/project.json"))).toBe(true);
    expect(fs.readFileSync(path.join(dir, "build/dev/.env.dev"), "utf8")).toBe(ENV("dev"));
  });

  it("removes the link and the update variables, and keeps the key and the app's settings", async () => {
    await Unlink.run(["--yes"], CLI_ROOT);
    expect(fs.existsSync(path.join(dir, ".capuchoo/project.json"))).toBe(false);
    expect(fs.existsSync(path.join(dir, ".capuchoo/signing-key.pem"))).toBe(true);
    const prod = fs.readFileSync(path.join(dir, "build/prod/.env.prod"), "utf8");
    expect(prod).not.toContain("VITE_UPDATE_API_URL");
    expect(prod).not.toContain("VITE_UPDATE_CHANNEL");
    expect(prod).not.toContain("# Capuchoo. Both are required");
    expect(prod).toContain("VITE_UPDATE_OTA_INSTALL=background");
    expect(prod).toContain("VITE_APP_ID=com.company.app");
  });

  it("deletes the signing key only when asked", async () => {
    await Unlink.run(["--yes", "--forget-signing-key"], CLI_ROOT);
    expect(fs.existsSync(path.join(dir, ".capuchoo/signing-key.pem"))).toBe(false);
  });

  it("is a no-op the second time", async () => {
    await Unlink.run(["--yes"], CLI_ROOT);
    const after = fs.readFileSync(path.join(dir, "build/dev/.env.dev"), "utf8");
    await Unlink.run(["--yes"], CLI_ROOT);
    expect(fs.readFileSync(path.join(dir, "build/dev/.env.dev"), "utf8")).toBe(after);
  });
});
