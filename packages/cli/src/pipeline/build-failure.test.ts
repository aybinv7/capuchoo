import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeBuildFailure, type DeployRequest } from "./deploy.js";

/**
 * A build that fails inside the application's own script is not a Capuchoo
 * failure, and reporting it bare reads as one. The user hit this repeatedly:
 * their app typechecks against a workspace dependency whose symlink dangles, so
 * every deploy ended in somebody else's TypeScript errors with no way forward
 * mentioned - while `dist/` already held a publishable build the whole time.
 */
function request(appDir: string, webDir = "dist"): DeployRequest {
  return {
    appDir,
    project: { webDir, versionCodeFile: "version-code.json" },
    kind: "ota",
    channel: "dev",
  } as unknown as DeployRequest;
}

function tempApp(webDirFiles: string[] | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-build-"));

  if (webDirFiles !== null) {
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
    for (const name of webDirFiles) fs.writeFileSync(path.join(dir, "dist", name), "x", "utf8");
  }

  return dir;
}

const FAILURE = new Error("pnpm run build:dev exited with 2");

describe("describeBuildFailure", () => {
  it("keeps the original error first", () => {
    const message = describeBuildFailure(FAILURE, request(tempApp(["index.html"])));

    expect(message.startsWith("pnpm run build:dev exited with 2")).toBe(true);
  });

  it("names whose command failed, and gives the way past it", () => {
    const message = describeBuildFailure(FAILURE, request(tempApp(["index.html"])));

    expect(message).toContain("your app's, not Capuchoo's");
    expect(message).toContain("capuchoo deploy ota --channel dev --skip-build");
    expect(message).toContain("build.command in .capuchoo/project.json");
  });

  it("uses the channel and kind that were actually asked for", () => {
    const req = { ...request(tempApp(["index.html"])), kind: "native", channel: "staging" };
    const message = describeBuildFailure(FAILURE, req as unknown as DeployRequest);

    expect(message).toContain("capuchoo deploy native --channel staging --skip-build");
  });

  /**
   * The suggestion has to be true. Pointing at --skip-build with nothing to
   * publish moves the failure one step later, to validateRequest refusing it.
   */
  it("suggests nothing when the webDir does not exist", () => {
    const message = describeBuildFailure(FAILURE, request(tempApp(null)));

    expect(message).toBe("pnpm run build:dev exited with 2");
  });

  it("suggests nothing when the webDir is empty", () => {
    const message = describeBuildFailure(FAILURE, request(tempApp([])));

    expect(message).not.toContain("--skip-build");
  });

  it("reads the project's own webDir, not a hardcoded dist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-build-"));
    fs.mkdirSync(path.join(dir, "www"), { recursive: true });
    fs.writeFileSync(path.join(dir, "www", "index.html"), "x", "utf8");

    const message = describeBuildFailure(FAILURE, request(dir, "www"));

    expect(message).toContain("www already holds a");
  });

  it("passes a non-Error through", () => {
    expect(describeBuildFailure("boom", request(tempApp(null)))).toBe("boom");
  });
});
