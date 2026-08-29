/**
 * Whether a required update is currently standing in the app's way.
 *
 * A required update is not one long block. Holding the user hostage for the
 * whole of an 8 MB download teaches them to force-quit, and a force-quit mid-
 * download is how an update never lands at all. So the gate closes at the two
 * moments a decision is actually needed and opens in between:
 *
 *   closed   nothing started yet          - the update has to be acknowledged
 *   open     downloading                  - keep using the app, it is working
 *   closed   downloaded, not installed    - the last step needs a tap
 *   closed   handed to Android            - its dialog is up, nothing else can happen
 *
 * Pure and framework-free on purpose: the composable renders it, an app may
 * route on it, and a test can cover every combination without a device.
 *
 * What it deliberately cannot do is install anything. Android asks the user to
 * confirm a sideloaded APK and there is no way past that - it is an OS security
 * boundary. "Required" means the app refuses to be used until they accept, not
 * that acceptance can be skipped.
 */

export type GateState =
  /** The app may be used. */
  | "open"
  /** Required, and nothing has started. The user must begin the update. */
  | "must-start"
  /** Required and downloaded. The user must hand it to the installer. */
  | "must-install"
  /** Android's install dialog is up. Nothing here can move it along. */
  | "awaiting-install";

export interface GateFacts {
  /** An update is on offer. */
  available: boolean;
  required: boolean;
  /** Native updates need a separate install step; OTA applies itself. */
  kind: "ota" | "native" | null;
  downloading: boolean;
  installing: boolean;
  /** A native artefact is on disk, ready to hand over. */
  downloaded: boolean;
  /** The APK has gone to the Android package installer. */
  handedToInstaller: boolean;
}

export interface Gate {
  state: GateState;
  /** Whether the app underneath may be interacted with. */
  blocked: boolean;
  /** One line saying why, for the UI to render verbatim. */
  reason: string;
}

const OPEN: Gate = { state: "open", blocked: false, reason: "" };

export function updateGate(facts: GateFacts): Gate {
  if (!facts.available || !facts.required) return OPEN;

  // Checked before `downloading`: the handoff happens after a download, and an
  // app that also kicked off a background check could otherwise read as busy.
  if (facts.handedToInstaller) {
    return {
      state: "awaiting-install",
      blocked: true,
      reason: "Waiting for Android to finish installing the update",
    };
  }

  // The concession that makes "required" survivable. A download is progress the
  // user cannot help with, so there is nothing to hold them for.
  if (facts.downloading || facts.installing) return OPEN;

  if (facts.kind === "native" && facts.downloaded) {
    return {
      state: "must-install",
      blocked: true,
      reason: "This update is ready and has to be installed before you can continue",
    };
  }

  return {
    state: "must-start",
    blocked: true,
    reason: "This update is required before you can continue",
  };
}

/**
 * Whether the prompt may be dismissed.
 *
 * Separate from `blocked`: an optional update is dismissible while a required
 * one that happens to be downloading is not blocked *and* not dismissible - the
 * app is usable, but the prompt stays, because it is still coming.
 */
export function isDismissible(facts: GateFacts): boolean {
  if (!facts.available) return false;
  if (facts.required) return false;

  return !facts.downloading && !facts.installing && !facts.handedToInstaller;
}
