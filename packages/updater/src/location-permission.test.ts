import { describe, expect, it } from "vite-plus/test";
import { isLocationServicesDisabledError } from "./device.js";

/**
 * The distinction this file exists to make.
 *
 * `@capacitor/geolocation` throws rather than returning a denied status when
 * the OS's Location toggle is off system-wide - undocumented, and the message
 * is the only signal:
 *
 *   Error: Location services are not enabled.
 *   code: OS-PLUG-GLOC-0007
 *
 * Found on a real device: Location was off, `requestLocationPermission` said
 * "denied", and the user had never been asked anything. The fix for a device
 * that has never seen the permission prompt is "turn on Location in Settings",
 * not "you said no" - and those need different copy in the app that calls this.
 */
describe("isLocationServicesDisabledError", () => {
  it("recognises the real error observed on a device", () => {
    const error = Object.assign(new Error("Location services are not enabled."), {
      code: "OS-PLUG-GLOC-0007",
    });

    expect(isLocationServicesDisabledError(error)).toBe(true);
  });

  it("matches on the code alone, in case the message wording changes", () => {
    const error = Object.assign(new Error("something else entirely"), {
      code: "OS-PLUG-GLOC-0007",
    });

    expect(isLocationServicesDisabledError(error)).toBe(true);
  });

  it("matches on the message alone, in case the code is absent", () => {
    expect(isLocationServicesDisabledError(new Error("Location services are not enabled."))).toBe(
      true,
    );
  });

  it("does not mistake an actual permission denial for a disabled service", () => {
    const error = Object.assign(new Error("User denied location permission"), {
      code: "OS-PLUG-GLOC-0008",
    });

    expect(isLocationServicesDisabledError(error)).toBe(false);
  });

  it.each([
    new Error("Network error"),
    new Error("Timeout"),
    "a bare string, not even an Error",
    null,
    undefined,
  ])("does not misclassify an unrelated failure (%s)", (error) => {
    expect(isLocationServicesDisabledError(error)).toBe(false);
  });
});
