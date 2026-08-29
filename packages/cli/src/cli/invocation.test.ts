import { describe, expect, it } from "vite-plus/test";
import { runCommand, runOnce } from "./invocation.js";

/**
 * The bug this exists for, seen on a real cavulsqa app: its manifest declares
 * `devEngines.packageManager: pnpm`, so npm refuses to run anything in that
 * directory - including this CLI, invoked exactly as our own messages spell it.
 *
 *   npm error EBADDEVENGINES Invalid name "pnpm" does not match "npm"
 */
describe("runCommand", () => {
  it("spells the command the way each package manager does", () => {
    expect(runCommand("pnpm", "deploy ota --channel dev")).toBe(
      "pnpm exec capuchoo deploy ota --channel dev",
    );
    expect(runCommand("npm", "doctor")).toBe("npx capuchoo doctor");
    expect(runCommand("yarn", "doctor")).toBe("yarn capuchoo doctor");
    expect(runCommand("bun", "doctor")).toBe("bunx capuchoo doctor");
  });

  it("never says bare npx for a pnpm project", () => {
    // The whole point: `npx capuchoo` is refused there, so printing it sends
    // someone to an error that reads like our bug.
    expect(runCommand("pnpm", "init").startsWith("npx")).toBe(false);
  });

  it("takes a bin name, for a CLI installed under another name", () => {
    expect(runCommand("pnpm", "doctor", "capu")).toBe("pnpm exec capu doctor");
  });

  it("has no trailing space when there are no arguments", () => {
    expect(runCommand("pnpm", "")).toBe("pnpm exec capuchoo");
  });
});

describe("runOnce", () => {
  it("names the package, because nothing is installed yet", () => {
    expect(runOnce("pnpm", "init")).toBe("pnpm dlx @capuchoo/cli init");
    expect(runOnce("npm", "init")).toBe("npx @capuchoo/cli init");
    expect(runOnce("bun", "init")).toBe("bunx @capuchoo/cli init");
  });

  it("uses npx for yarn, because dlx is Berry-only", () => {
    // Being conservative costs nothing; being wrong sends classic yarn users to
    // an unrecognised command.
    expect(runOnce("yarn", "init")).toBe("npx @capuchoo/cli init");
  });

  it("differs from runCommand, which assumes it is already a dependency", () => {
    expect(runOnce("pnpm", "doctor")).not.toBe(runCommand("pnpm", "doctor"));
  });
});
