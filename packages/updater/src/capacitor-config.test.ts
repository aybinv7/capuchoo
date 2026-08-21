import { describe, expect, it } from "vite-plus/test";
import { capuchoUpdaterConfig } from "./capacitor-config.js";

/**
 * This helper exists because the plugin's `autoUpdate` mode has to agree with
 * how the app drives updates, and the app template had them disagreeing.
 */

const base = {
  apiUrl: "https://capuchoo-back.example",
  channel: "staging",
  version: "19.0.0",
};

describe("capuchoUpdaterConfig", () => {
  it('defaults to "onlyDownload", not true', () => {
    // autoUpdate: true made the plugin apply bundles on its own schedule while
    // the app was also calling download() and set().
    expect(capuchoUpdaterConfig(base).autoUpdate).toBe("onlyDownload");
  });

  it("disables plugin-driven updates in manual mode", () => {
    expect(capuchoUpdaterConfig({ ...base, mode: "manual" }).autoUpdate).toBe(false);
  });

  it("builds the three endpoints the plugin needs", () => {
    const config = capuchoUpdaterConfig(base);
    expect(config.updateUrl).toBe("https://capuchoo-back.example/api/update");
    expect(config.statsUrl).toBe("https://capuchoo-back.example/api/stats");
    expect(config.channelUrl).toBe("https://capuchoo-back.example/api/channel_self");
  });

  it("tolerates a trailing slash on the base URL", () => {
    const config = capuchoUpdaterConfig({ ...base, apiUrl: "https://x.example///" });
    expect(config.updateUrl).toBe("https://x.example/api/update");
  });

  it("refuses an empty apiUrl instead of shipping updates disabled", () => {
    // The plugin accepts an empty updateUrl and then silently never checks,
    // which is the worst possible outcome. The old config produced exactly
    // that whenever VITE_UPDATE_API_URL was unset.
    expect(() => capuchoUpdaterConfig({ ...base, apiUrl: "" })).toThrow(/apiUrl is empty/);
    expect(() => capuchoUpdaterConfig({ ...base, apiUrl: "///" })).toThrow(/apiUrl is empty/);
  });

  it("never lets the plugin apply a bundle under the user", () => {
    // directUpdate would reload the WebView mid-prompt.
    expect(capuchoUpdaterConfig(base).directUpdate).toBe(false);
  });

  it("keeps allowModifyUrl off unless asked", () => {
    // It lets anything running in the WebView redirect update downloads.
    expect(capuchoUpdaterConfig(base).allowModifyUrl).toBe(false);
    expect(capuchoUpdaterConfig({ ...base, allowModifyUrl: true }).allowModifyUrl).toBe(true);
  });

  it("passes the channel and version straight through", () => {
    const config = capuchoUpdaterConfig(base);
    expect(config.defaultChannel).toBe("staging");
    expect(config.version).toBe("19.0.0");
  });

  it("has timeouts that can be overridden", () => {
    expect(capuchoUpdaterConfig(base).appReadyTimeout).toBe(10_000);
    expect(capuchoUpdaterConfig({ ...base, appReadyTimeout: 20_000 }).appReadyTimeout).toBe(20_000);
  });
});
