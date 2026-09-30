import { describe, expect, it } from "vite-plus/test";
import { describeReplacement } from "./file-diff.js";
import { parseClients, readGitlabTemplate, renderGitlabCi } from "./gitlab-template.js";

describe("parseClients", () => {
  it("maps clients to prod-<client> channels, de-duplicated", () => {
    expect(parseClients(" Acme, globex,acme, prod-initech ,")).toEqual([
      { client: "acme", channel: "prod-acme" },
      { client: "globex", channel: "prod-globex" },
      { client: "initech", channel: "prod-initech" },
    ]);
  });

  it("refuses a name that would break the YAML or a channel", () => {
    expect(() => parseClients("acme corp")).toThrow('"acme corp" is not a usable client name');
    expect(() => parseClients("a:b")).toThrow("not a usable client name");
  });

  it("is empty without --clients", () => {
    expect(parseClients(undefined)).toEqual([]);
  });
});

describe("renderGitlabCi", () => {
  const template = readGitlabTemplate();

  it("pins the CLI version and adds one manual deliver job per client", () => {
    const rendered = renderGitlabCi(template, "0.16.0", parseClients("acme,globex"));

    expect(rendered).not.toContain("__CAPUCHOO_CLI_VERSION__");
    expect(rendered).toContain('CAPUCHOO_CLI_VERSION: "0.16.0"');
    expect(rendered).toContain(
      'deliver:acme:\n  extends: .deliver\n  resource_group: capuchoo-prod-acme\n  variables:\n    CAPUCHOO_TARGET_CHANNEL: "prod-acme"',
    );
    expect(rendered).toContain("deliver:globex:");
    expect(rendered).not.toContain("# capuchoo:deliver-jobs\n");
  });

  it("keeps the stages, publishes each release branch to its channel and delivers by pointing", () => {
    const rendered = renderGitlabCi(template, "0.16.0", []);
    expect(rendered).toMatch(/stages:\n {2}- check\n {2}- publish\n {2}- deliver/);
    expect(rendered).toContain("publish:ota:");
    expect(rendered).toContain("publish:native:");
    expect(rendered).toContain('--channel "$CAPUCHOO_CHANNEL"');
    for (const channel of ["prod", "staging", "dev"])
      expect(rendered).toContain(`variables: { CAPUCHOO_CHANNEL: "${channel}" }`);
    expect(rendered).toContain('channel point "$CAPUCHOO_TARGET_CHANNEL"');
    expect(rendered).toContain("when: manual");
    expect(rendered).toContain("capuchoo:deliver-jobs - none yet");
  });

  it("builds OTA bundles without the Android SDK and assumes no package manager", () => {
    const rendered = renderGitlabCi(template, "0.16.0", []);
    const web = rendered.slice(rendered.indexOf("\n.web:"), rendered.indexOf("\n.native:"));
    expect(web).not.toContain("sdkmanager");
    expect(rendered).toContain("pnpm install --frozen-lockfile");
    expect(rendered).toContain("npm ci");
    expect(rendered).not.toContain("pnpm exec capuchoo");
  });

  it("never writes a secret into the file", () => {
    const rendered = renderGitlabCi(template, "0.16.0", parseClients("acme"));
    expect(rendered).not.toMatch(/CAPUCHOO_API_KEY:\s*\S/);
    expect(rendered).not.toMatch(/CAPUCHOO_SIGNING_KEY:\s*\S/);
  });

  it("refuses a template without placeholders", () => {
    expect(() => renderGitlabCi("stages: []", "0.16.0", [])).toThrow("placeholders");
  });
});

describe("describeReplacement", () => {
  it("lists removed and added lines", () => {
    expect(describeReplacement(".gitlab-ci.yml", "a\nb\nc\n", "a\nc\nd\n")).toBe(
      ".gitlab-ci.yml\n  - b\n  + d",
    );
  });

  it("caps long diffs", () => {
    const after = Array.from({ length: 10 }, (_, index) => `line ${index}`).join("\n");
    expect(describeReplacement("f", "", after, 3).split("\n")).toHaveLength(5);
  });
});
