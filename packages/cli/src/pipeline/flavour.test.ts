import { describe, expect, it } from "vitest";
import { parseEnvFile } from "./flavour.js";

describe("parseEnvFile", () => {
  it("reads plain assignments", () => {
    expect(parseEnvFile("VITE_APP_ID=com.ayb.lowmaro\nVERSION_CODE=5")).toEqual({
      VITE_APP_ID: "com.ayb.lowmaro",
      VERSION_CODE: "5",
    });
  });

  it("ignores comments and blank lines", () => {
    const parsed = parseEnvFile(
      ["# Development build", "", "VITE_APP_NAME=Lowmaro", "   ", "# trailing"].join(
        "\n",
      ),
    );
    expect(parsed).toEqual({ VITE_APP_NAME: "Lowmaro" });
  });

  it("keeps an empty value rather than dropping the key", () => {
    // build/dev/.env.dev really does ship `VITE_API_URL=`, and the difference
    // between "set to empty" and "absent" decides whether a default applies.
    expect(parseEnvFile("VITE_API_URL=")).toEqual({ VITE_API_URL: "" });
  });

  it("strips surrounding quotes but keeps inner ones", () => {
    expect(parseEnvFile('A="hello world"\nB=\'single\'\nC="say "hi""')).toEqual({
      A: "hello world",
      B: "single",
      C: 'say "hi"',
    });
  });

  it("keeps a # that is part of an unquoted value", () => {
    expect(parseEnvFile("COLOR=#ffffff")).toEqual({ COLOR: "#ffffff" });
  });

  it("drops a trailing inline comment on an unquoted value", () => {
    expect(parseEnvFile("ENABLE_LOGGING=true # noisy")).toEqual({
      ENABLE_LOGGING: "true",
    });
  });

  it("keeps a # inside a quoted value", () => {
    expect(parseEnvFile('URL="https://x.test/#/route"')).toEqual({
      URL: "https://x.test/#/route",
    });
  });

  it("tolerates an export prefix", () => {
    expect(parseEnvFile("export VITE_APP_ID=com.x.y")).toEqual({
      VITE_APP_ID: "com.x.y",
    });
  });

  it("handles CRLF files", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("skips lines that are not assignments", () => {
    expect(parseEnvFile("just some text\n=novalue\n1BAD=x\nGOOD=y")).toEqual({
      GOOD: "y",
    });
  });

  it("keeps = characters inside a value", () => {
    expect(parseEnvFile("TOKEN=abc=def==")).toEqual({ TOKEN: "abc=def==" });
  });
});
