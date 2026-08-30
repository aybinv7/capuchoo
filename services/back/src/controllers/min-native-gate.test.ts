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

/**
 * The gate's own failure mode, and where it has to be caught.
 *
 * If no native release at or above the line is assigned to the channel, the
 * server looks for the binary to offer, finds none, and answers
 * `native_update: null`. `resolveUpdate` reads that as "no update at all", so
 * the device is not crashed - it is frozen. It never takes the bundle, is never
 * told why, and the release still reads as published. Every device on the
 * channel stops updating and nothing anywhere says so.
 *
 * Nothing can be done about it at serve time: there is no one to tell and no
 * operation to refuse. So it is checked where the gate is written.
 */
describe("a gate the channel cannot satisfy is refused where it is set", () => {
  it("checks the upload before the artefact reaches storage", () => {
    const guard = controller.indexOf("assertNativeGateSatisfiable(appUuid");
    const upload = controller.indexOf("this.fileService.uploadFile(fileName, buffer)");

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(upload);
  });

  /**
   * Promote is the one-click version: it carries `min_update_version` across in
   * a whole-row copy and then repoints `channels.current_version_id`, so a gate
   * prod cannot satisfy takes out every production device at once.
   */
  it("checks a promote against the target channel, not the source", () => {
    // `targetApp.data.id` and `target_channel`, not the source row's app and
    // channel: the whole point is that the destination has a different native.
    const promoteGuard = controller.slice(
      controller.indexOf("promoteBundle"),
      controller.indexOf("promoteBundle") + 4000,
    );

    expect(promoteGuard).toContain("assertNativeGateSatisfiable");
    expect(promoteGuard).toContain("targetApp.data.id");
    expect(promoteGuard).toContain("target_channel");
    expect(promoteGuard).toContain("sourceData.min_update_version");
  });

  it("does not ask the question of a promoted native binary", () => {
    // A binary carries no gate; only bundles have one, and reading
    // `min_update_version` off a native row reads a column that is not there.
    const promoteGuard = controller.slice(
      controller.indexOf("promoteBundle"),
      controller.indexOf("promoteBundle") + 4000,
    );
    const branch = promoteGuard.indexOf('promoteType === "bundle"');
    const guard = promoteGuard.indexOf("assertNativeGateSatisfiable");

    expect(branch).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(guard);
  });
});

/**
 * A gate can also become unsatisfiable long after it was set.
 *
 * The upload and promote guards check a gate against its channel at the moment
 * it is written. Nothing held afterwards: `updateChannel` writes whatever it is
 * handed, so repointing the channel's native at an older binary - or its bundle
 * at one the current binary cannot satisfy - rebuilds the stranded state one
 * dropdown at a time, on a channel that was already correct.
 */
describe("moving a channel's pointers cannot strand its devices", () => {
  it("checks before the write, not after", () => {
    const handler = controller.slice(
      controller.indexOf("async updateChannel"),
      controller.indexOf("async updateChannel") + 2000,
    );
    const guard = handler.indexOf("assertChannelPointersConsistent");
    const write = handler.indexOf("this.supabaseService.update");

    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });

  it("passes the whole sanitized change, so either pointer is seen", () => {
    // The channel page submits both in one request; checking only the field
    // that moved would miss the pair that results.
    expect(controller).toContain("assertChannelPointersConsistent(id as string, sanitizedData)");
  });
});
