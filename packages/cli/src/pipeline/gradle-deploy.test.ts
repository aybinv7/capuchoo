import { describe, expect, it } from "vite-plus/test";
import { describeIgnoredVersion, parseGradleVersion } from "./gradle-deploy.js";

describe("parseGradleVersion", () => {
  it("reads plain assignments in either DSL", () => {
    expect(parseGradleVersion('versionCode 512\n        versionName "1.1.162"')).toEqual({
      name: "1.1.162",
      code: 512,
    });
    expect(parseGradleVersion('  versionCode = 12\n  versionName = "1.3.0"')).toEqual({
      name: "1.3.0",
      code: 12,
    });
  });

  it("reads the fallback of the lines a deploy's version properties need", () => {
    const gradle = [
      '        versionCode = (findProperty("capuchoo.versionCode") as String?)?.toInt() ?: 7',
      '        versionName = findProperty("capuchoo.versionName") as String? ?: "2.0.0"',
    ].join("\n");
    expect(parseGradleVersion(gradle)).toEqual({ name: "2.0.0", code: 7 });
  });

  it("is null when either is missing", () => {
    expect(parseGradleVersion('versionName "1.0"')).toBeNull();
  });
});

describe("describeIgnoredVersion", () => {
  it("prints the two lines that make the build take the deploy's version", () => {
    const message = describeIgnoredVersion(
      { name: "1.0.1-dev.1", code: 2 },
      { name: "1.0.0", code: 1 },
    );
    expect(message).toContain("built as 1.0.0 (1), not 1.0.1-dev.1 (2)");
    expect(message).toContain('findProperty("capuchoo.versionCode")');
    expect(message).toContain('?: "1.0.0"');
  });
});
