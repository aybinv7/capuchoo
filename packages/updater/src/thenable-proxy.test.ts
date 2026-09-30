import { describe, expect, it, vi } from "vite-plus/test";

/** A stand-in for a Capacitor plugin proxy: every property is a native call, `then` included. */
function thenableProxy(onCall: (name: string) => void) {
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        const name = String(property);
        return (..._args: unknown[]) => {
          onCall(name);
          if (name === "then") return undefined;
          if (name === "getStatus") return Promise.resolve({ connected: true });
          return Promise.resolve({ remove: () => Promise.resolve() });
        };
      },
    },
  );
}

const calls: string[] = [];
const network = thenableProxy((name) => calls.push(name));
const notifications = thenableProxy((name) => calls.push(`notify:${name}`));

vi.mock("@capacitor/app", () => ({
  App: { addListener: () => Promise.resolve({ remove: () => Promise.resolve() }) },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "android",
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
  },
  registerPlugin: () => notifications,
}));
vi.mock("./optional-plugins.js", () => ({
  nativePlugins: { network: () => Promise.resolve({ Network: network }) },
}));

const { watchLifecycle } = await import("./lifecycle.js");

function settles<T>(promise: Promise<T>, ms = 500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("never settled")), ms)),
  ]);
}

describe("plugin proxies are thenable", () => {
  it("watchLifecycle settles and subscribes to the network", async () => {
    const handles = await settles(watchLifecycle({ onResume: () => {}, onReconnect: () => {} }));
    expect(handles).toHaveLength(2);
    expect(calls).toContain("addListener");
    expect(calls).not.toContain("then");
  });
});
