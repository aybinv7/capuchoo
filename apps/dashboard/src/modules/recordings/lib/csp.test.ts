import { describe, expect, it } from "vite-plus/test";
import renderBlueprint from "../../../../../../render.yaml?raw";
import nginxHeaders from "../../../../../../deploy/dashboard/security-headers.conf?raw";

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name);
  return found?.slice(1) ?? [];
}

const render = renderBlueprint
  .match(/name: Content-Security-Policy\s+value: >-\s+([\s\S]*?)\n\s+- path:/)?.[1]
  ?.replace(/\s+/g, " ")
  .trim();
/** Behind nginx the dashboard and the server share an origin, which 'self' covers. */
const RENDER_SOCKETS = "wss://capuchoo-server.onrender.com";

const nginx = nginxHeaders.match(/Content-Security-Policy "([^"]+)"/)?.[1];

describe("the dashboard's content security policy", () => {
  it("lets the replay load the app's stylesheets, which it serves from blob URLs", () => {
    for (const policy of [render, nginx]) {
      expect(policy).toBeTruthy();
      expect(directive(policy!, "style-src")).toContain("blob:");
    }
  });

  it("lets the dashboard on Render open assist sockets to the server, a separate origin there", () => {
    expect(directive(render!, "connect-src")).toContain(RENDER_SOCKETS);
  });

  it("is the same on Render and behind nginx, apart from that origin", () => {
    expect(render!.replace(` ${RENDER_SOCKETS}`, "")).toBe(nginx);
  });
});
