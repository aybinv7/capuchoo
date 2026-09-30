import type { ResolvedUpdate } from "@capuchoo/core";
import { reportUpdateEvent } from "../api.service.js";
import { getUpdaterConfig } from "../config.js";
import { getVersionCode } from "../device.js";
import { pruneApkCache } from "../download.service.js";
import { isInstallAbandoned, settleInstall } from "../install-attempts.js";
import { loadInstallRecord, saveInstallRecord } from "../install-record.js";
import { NO_PROGRESS, state } from "./updater-state.js";

/** Shown once installing the same native version has failed repeatedly. */
export const INSTALL_ABANDONED_MESSAGE =
  "This update could not be installed over the current build. If Android said " +
  '"App not installed", it is signed with a different key than the installed app - ' +
  "uninstall the app and install the new version manually.";

const RETRY_MESSAGE = "The update was not installed. Tap Install to try again.";

let settling: Promise<void> | null = null;

function markAbandoned(failures: number): void {
  state.value.installFailures = failures;
  state.value.installAbandoned = true;
  state.value.error = INSTALL_ABANDONED_MESSAGE;
}

async function settle(): Promise<void> {
  const update = state.value.currentUpdate;
  if (!update || update.kind !== "native") {
    state.value.handedToInstaller = false;
    return;
  }

  const [installedVersionCode, record] = await Promise.all([getVersionCode(), loadInstallRecord()]);
  const { settlement, record: next } = settleInstall({
    offeredVersionCode: update.versionCode ?? 0,
    installedVersionCode,
    record,
  });
  await saveInstallRecord(next);

  state.value.handedToInstaller = false;

  if (settlement.kind === "installed") {
    state.value.updateAvailable = false;
    state.value.currentUpdate = null;
    state.value.cachedPath = null;
    state.value.progress = { ...NO_PROGRESS };
    state.value.installFailures = 0;
    state.value.installAbandoned = false;
    state.value.error = null;
    state.value.statusMessage = "";
    state.value.lastCheckMessage = `${getUpdaterConfig().appName} ${update.version} is installed`;
    void pruneApkCache({ installedVersionCode });
    return;
  }

  state.value.installFailures = settlement.failures;
  reportUpdateEvent("error", update, {
    error: `installer returned without installing (attempt ${settlement.failures})`,
  });

  if (settlement.abandoned) {
    markAbandoned(settlement.failures);
    state.value.statusMessage = "";
    return;
  }

  state.value.statusMessage = RETRY_MESSAGE;
}

/**
 * Settles an APK handed to the installer, once the app is back in front: the
 * installed build number says whether it landed. Not installed returns the
 * prompt to "downloaded, install again"; repeated failure stops blocking.
 * Concurrent resumes share one settlement.
 */
export function settleInstallerHandoff(): Promise<void> {
  settling ??= settle()
    .catch((error: unknown) => {
      state.value.handedToInstaller = false;
      console.error("[capuchoo] could not settle the installer handoff", error);
    })
    .finally(() => {
      settling = null;
    });
  return settling;
}

/** Applies a persisted failure count to a native update just offered again. */
export async function restoreInstallAttempts(update: ResolvedUpdate): Promise<void> {
  if (update.kind !== "native") return;

  const record = await loadInstallRecord();
  if (!record || record.versionCode !== update.versionCode) return;

  if (isInstallAbandoned(record, update.versionCode)) markAbandoned(record.failures);
  else state.value.installFailures = record.failures;
}

/** Drops a failure record the installed build has already overtaken. */
export async function forgetOvertakenInstall(installedVersionCode: number): Promise<void> {
  const record = await loadInstallRecord();
  if (record && installedVersionCode >= record.versionCode) await saveInstallRecord(null);
}
