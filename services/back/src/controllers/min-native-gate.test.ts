import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * The native gate existed everywhere except where it is set.
 *
 * `app_versions.min_update_version` has always been in the schema.
 * `decideUpdate` has always honoured it - a device below that native version is
 * answered `native-required` and offered the binary instead of the bundle - and
 * `update-decision.test.ts` has always covered it. The dashboard even shows it,
 * as `min_native_version`.
 *
 * Nothing ever wrote it. No CLI flag, no request field, no admin endpoint. The
 * one gate that stops a web bundle landing on a binary too old to run it was
 * unreachable from every supported path, so the whole feature existed only in
 * tests - which is not the same as existing.
 *
 * Found while setting up a real device test for exactly that case, and being
 * unable to arrange it.
 */
const controller = fs.readFileSync(path.join(import.meta.dirname, "adminController.ts"), "utf8");

describe("an upload can declare the native version it needs", () => {
  it("reads min_update_version off the request", () => {
    expect(controller).toContain("min_update_version,");
  });

  it("stores it on the version row", () => {
    expect(controller).toContain("{ min_update_version: minUpdateVersion }");
  });

  it("omits the column when nothing was sent", () => {
    // Spreading a conditional rather than writing null: the column ships after
    // the code in this project more than once, and `insertTolerantOfFlavour`
    // exists for the same reason.
    expect(controller).toContain("...(minUpdateVersion ? {");
  });

  /**
   * It is a build *number*, despite the column's name, and that is the trap.
   *
   * `minimumNativeVersion` parses the column with `Number.parseInt` and compares
   * it to the device's `version_code`. `parseInt("0.6.0")` is 0, and the same
   * function reads 0 as "ungated" - so a semver string, the value that looks
   * most like a version and is the obvious thing to type, silently switches the
   * gate off while the release still looks published. That is the exact failure
   * this gate exists to prevent, arrived at by using the gate.
   *
   * Caught before shipping only because the first cut of the flag validated
   * semver, which would have made `--min-native 0.6.0` mean "no gate at all".
   */
  it("refuses anything that is not a build number", () => {
    expect(controller).toContain("/^[0-9]+$/");
    expect(controller).toContain("native build number, not a version name");
  });

  it("says what to use instead, in the message", () => {
    // "Invalid value" would leave someone to guess between 2.4.0, v10 and 10.
    expect(controller).toContain("versionCode of the binary this bundle needs");
  });

  it("treats an empty field as absent rather than invalid", () => {
    // Multipart form fields arrive as "" when a client sends the key with no
    // value, and rejecting that would break every upload that sets no gate.
    expect(controller).toContain('min_update_version === ""');
  });
});
