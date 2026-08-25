import { describe, expect, it } from "vite-plus/test";
import { capuchooUpdaterConfig } from "./capacitor-config.js";

/**
 * This helper exists because the plugin's `autoUpdate` mode has to agree with
 * how the app drives updates, and the app template had them disagreeing.
 */

const base = {
  apiUrl: "https://capuchoo-back.example",
  channel: "staging",
  version: "19.0.0",
};

describe("capuchooUpdaterConfig", () => {
  it('defaults to "onlyDownload", not true', () => {
    // autoUpdate: true made the plugin apply bundles on its own schedule while
    // the app was also calling download() and set().
    expect(capuchooUpdaterConfig(base).autoUpdate).toBe("onlyDownload");
  });

  it("disables plugin-driven updates in manual mode", () => {
    expect(capuchooUpdaterConfig({ ...base, mode: "manual" }).autoUpdate).toBe(false);
  });

  it("builds the three endpoints the plugin needs", () => {
    const config = capuchooUpdaterConfig(base);
    expect(config.updateUrl).toBe("https://capuchoo-back.example/api/update");
    expect(config.statsUrl).toBe("https://capuchoo-back.example/api/stats");
    expect(config.channelUrl).toBe("https://capuchoo-back.example/api/channel_self");
  });

  it("tolerates a trailing slash on the base URL", () => {
    const config = capuchooUpdaterConfig({ ...base, apiUrl: "https://x.example///" });
    expect(config.updateUrl).toBe("https://x.example/api/update");
  });

  it("refuses an empty apiUrl instead of shipping updates disabled", () => {
    // The plugin accepts an empty updateUrl and then silently never checks,
    // which is the worst possible outcome.
    expect(() => capuchooUpdaterConfig({ ...base, apiUrl: "" })).toThrow(/apiUrl/);
    expect(() => capuchooUpdaterConfig({ ...base, apiUrl: "///" })).toThrow(/not a URL/);
  });

  /**
   * The case the tests above did not cover, and the only one that happens.
   *
   * Every call site writes `process.env.VITE_UPDATE_API_URL`, which is
   * `undefined` when unset - not `""`. The guard ran *after*
   * `options.apiUrl.replace(...)`, so the helpful message was unreachable and a
   * bare `npx cap sync` died with "Cannot read properties of undefined (reading
   * 'replace')" and a stack inside node_modules.
   *
   * The old tests passed the whole time. They exercised the shape the author
   * imagined rather than the shape the environment produces.
   */
  it.each([
    ["apiUrl", { apiUrl: undefined }],
    ["channel", { channel: undefined }],
  ])("names %s when the environment did not set it", (key, override) => {
    expect(() => capuchooUpdaterConfig({ ...base, ...override })).toThrow(
      new RegExp(`${key} is missing`),
    );
  });

  it("names every missing value at once, not one build at a time", () => {
    const thrown = () => capuchooUpdaterConfig({ ...base, apiUrl: undefined, channel: undefined });

    expect(thrown).toThrow(/apiUrl and channel are missing/);
    expect(thrown).toThrow(/VITE_UPDATE_API_URL/);
    expect(thrown).toThrow(/VITE_UPDATE_CHANNEL/);
  });

  it("says why a bare cap sync has neither", () => {
    expect(() => capuchooUpdaterConfig({ ...base, apiUrl: undefined })).toThrow(/cap sync/);
  });

  // Whitespace is what a half-filled env file produces, and it is not a URL.
  it("treats a blank value as missing", () => {
    expect(() => capuchooUpdaterConfig({ ...base, apiUrl: "   " })).toThrow(/apiUrl is missing/);
  });

  /**
   * Omitted, the plugin reports the binary's own versionName - which cannot go
   * stale. Emitting `version: undefined` instead would tell the plugin the
   * built-in bundle has no version at all.
   */
  it("leaves version out when the app does not override it", () => {
    expect("version" in capuchooUpdaterConfig({ ...base, version: undefined })).toBe(false);
    expect(capuchooUpdaterConfig({ ...base, version: "1.0.56" }).version).toBe("1.0.56");
  });

  it("never lets the plugin apply a bundle under the user", () => {
    // directUpdate would reload the WebView mid-prompt.
    expect(capuchooUpdaterConfig(base).directUpdate).toBe(false);
  });

  it("keeps allowModifyUrl off unless asked", () => {
    // It lets anything running in the WebView redirect update downloads.
    expect(capuchooUpdaterConfig(base).allowModifyUrl).toBe(false);
    expect(capuchooUpdaterConfig({ ...base, allowModifyUrl: true }).allowModifyUrl).toBe(true);
  });

  it("passes the channel and version straight through", () => {
    const config = capuchooUpdaterConfig(base);
    expect(config.defaultChannel).toBe("staging");
    expect(config.version).toBe("19.0.0");
  });

  it("has timeouts that can be overridden", () => {
    expect(capuchooUpdaterConfig(base).appReadyTimeout).toBe(10_000);
    expect(capuchooUpdaterConfig({ ...base, appReadyTimeout: 20_000 }).appReadyTimeout).toBe(
      20_000,
    );
  });
});
