import { describe, expect, it } from "vite-plus/test";
import { renderGithubWorkflow } from "./github-workflow.js";

describe("renderGithubWorkflow", () => {
  it("is deterministic and pins the CLI version", () => {
    const first = renderGithubWorkflow({ cliVersion: "0.17.0", clients: ["acme"] });
    expect(renderGithubWorkflow({ cliVersion: "0.17.0", clients: ["acme"] })).toBe(first);
    expect(first).toContain('CAPUCHOO_CLI_VERSION: "0.17.0"');
  });

  it("only offers deliver when there are clients", () => {
    const without = renderGithubWorkflow({ cliVersion: "1.0.0" });
    expect(without).not.toContain("\n  deliver:");
    expect(without).toContain('options: ["ota", "native", "check"]');
    const withClients = renderGithubWorkflow({
      cliVersion: "1.0.0",
      clients: ["prod-acme", "Globex", "acme"],
    });
    expect(withClients).toContain("\n  deliver:");
    expect(withClients).toContain('options: ["none", "acme", "globex"]');
    expect(withClients).toContain('CLIENTS: "acme globex"');
  });

  it("never interpolates an expression inside a shell script", () => {
    const text = renderGithubWorkflow({ cliVersion: "1.0.0", clients: ["acme"] });
    const runBlocks = text.split(/\n\s+run: /).slice(1);
    for (const block of runBlocks) {
      const script = block.split(/\n\s+- /)[0] ?? "";
      expect(script).not.toMatch(/\$\{\{/);
    }
  });

  it("keeps secrets out of the workflow-wide environment", () => {
    const text = renderGithubWorkflow({ cliVersion: "1.0.0" });
    const head = text.slice(0, text.indexOf("\njobs:"));
    expect(head).not.toContain("secrets.");
  });

  it.each([
    [{ appDir: "../outside" }],
    [{ appDir: "/abs" }],
    [{ devBranch: "dev\n  evil: true" }],
    [{ clients: ['acme"; echo'] }],
    [{ devBranch: "main" }],
    [{ cliVersion: "1.0.0\nx" }],
  ])("refuses unsafe options %j", (options) => {
    expect(() => renderGithubWorkflow({ cliVersion: "1.0.0", ...options })).toThrow();
  });
});
