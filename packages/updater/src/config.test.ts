import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  configureUpdater,
  describeConfigProblems,
  getUpdaterConfig,
  resetUpdaterConfig,
} from "./config.js";

afterEach(() => {
  resetUpdaterConfig();
});

describe("getUpdaterConfig", () => {
  it("has no hard-coded backend or app id", () => {
    // The previous implementation defaulted apiUrl to a specific Render URL and
    // appId to a specific bundle id, so a build with a missing variable pointed
    // at someone else's backend and asked about the wrong app - while
    // reporting "you are up to date".
    const config = getUpdaterConfig();
    expect(config.apiUrl).toBe("");
    expect(config.appId).toBe("");
  });

  it("applies overrides", () => {
    configureUpdater({ apiUrl: "https://x.example", appId: "com.x.y" });
    const config = getUpdaterConfig();
    expect(config.apiUrl).toBe("https://x.example");
    expect(config.appId).toBe("com.x.y");
  });

  it("strips trailing slashes so URL joining cannot double up", () => {
    configureUpdater({ apiUrl: "https://x.example//" });
    expect(getUpdaterConfig().apiUrl).toBe("https://x.example");
  });

  it("merges successive overrides", () => {
    configureUpdater({ apiUrl: "https://a.example" });
    configureUpdater({ channel: "beta" });
    const config = getUpdaterConfig();
    expect(config.apiUrl).toBe("https://a.example");
    expect(config.channel).toBe("beta");
  });

  it("defaults the channel to prod and has a request timeout", () => {
    const config = getUpdaterConfig();
    expect(config.channel).toBe("prod");
    expect(config.timeoutMs).toBeGreaterThan(0);
  });
});

describe("describeConfigProblems", () => {
  it("reports both missing variables at once", () => {
    expect(describeConfigProblems(getUpdaterConfig())).toHaveLength(2);
  });

  it("names the variable the developer has to set", () => {
    const problems = describeConfigProblems(getUpdaterConfig());
    expect(problems.join(" ")).toContain("VITE_UPDATE_API_URL");
    expect(problems.join(" ")).toContain("VITE_APP_ID");
  });

  it("is satisfied by a complete configuration", () => {
    configureUpdater({ apiUrl: "https://x.example", appId: "com.x.y" });
    expect(describeConfigProblems(getUpdaterConfig())).toEqual([]);
  });
});
