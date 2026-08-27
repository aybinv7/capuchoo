import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Nothing on disk may change before the request has been validated.
 *
 * This has now regressed twice. The pipeline bumped `package.json` first and
 * discovered a missing env file second, so a deploy that could never have
 * succeeded still advanced the version - three attempts took a real app from
 * 5.0.0 to 8.0.0 with nothing published, each one printing "package.json was
 * already bumped" as though that were an acceptable outcome.
 *
 * Asserted on the source order rather than by running a deploy, because a deploy
 * needs a project, a toolchain and a backend. Crude, but it fails the moment the
 * two lines swap - which is exactly the mistake being guarded.
 */
const execute = fs.readFileSync(path.join(import.meta.dirname, "execute.ts"), "utf8");

describe("validate before mutating", () => {
  it("validates the request before writing the version", () => {
    const validation = execute.indexOf("validateRequest(request");
    const write = execute.indexOf("writeAppVersion(appDir, version)");

    expect(validation, "validateRequest(request ...) not found").toBeGreaterThan(-1);
    expect(write, "writeAppVersion(appDir, version) not found").toBeGreaterThan(-1);
    expect(validation).toBeLessThan(write);
  });

  it("says nothing was changed when it refuses", () => {
    // The old message told you to run `git checkout -- package.json`, which is
    // only needed because it had already written to it.
    expect(execute).toContain("Nothing was changed.");
  });

  it("still writes the version only after the deploy is confirmed", () => {
    const confirmation = execute.indexOf('await confirm("Deploy?"');
    const write = execute.indexOf("writeAppVersion(appDir, version)");

    expect(confirmation).toBeGreaterThan(-1);
    expect(confirmation).toBeLessThan(write);
  });

  it("runDeploy validates too, for its other callers", () => {
    const pipeline = fs.readFileSync(
      path.join(import.meta.dirname, "..", "pipeline", "deploy.ts"),
      "utf8",
    );

    const validation = pipeline.indexOf("validateRequest(request, flavour)");
    const codes = pipeline.indexOf("writeVersionCodes(");

    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(codes);
  });
});
