import { describe, expect, it } from "vite-plus/test";
import nginxHeaders from "../../../../../../deploy/dashboard/security-headers.conf?raw";

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name);
  return found?.slice(1) ?? [];
}

const nginx = nginxHeaders.match(/Content-Security-Policy "([^"]+)"/)?.[1];

describe("the dashboard's content security policy", () => {
  it("lets the replay load the app's stylesheets, which it serves from blob URLs", () => {
    expect(nginx).toBeTruthy();
    expect(directive(nginx!, "style-src")).toContain("blob:");
  });

  it("keeps API and socket traffic on the dashboard's own origin", () => {
    expect(directive(nginx!, "connect-src")).toEqual(["'self'"]);
  });

  it("lets the GitHub App manifest form post to GitHub", () => {
    expect(directive(nginx!, "form-action")).toContain("https://github.com");
  });
});
