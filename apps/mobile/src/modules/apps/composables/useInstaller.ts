import type { PluginListenerHandle } from "@capacitor/core";
import { recordActivity } from "@/domains/activity/activity.repository";
import type { App, Identifier, Installed, NativeBuild } from "@/domains/catalog/catalog.repository";
import { can } from "@/shared/access/capabilities";
import { api } from "@/shared/api/endpoints";
import { rdb } from "@/shared/database";
import { CapuchooDevice, hasDevice, type DownloadResult, type InstallEvent } from "@/shared/native/device";
import { credentials } from "@/shared/session/session";
import { refreshInstalled } from "@/shared/sync/sync";
import { bump, tick } from "@/shared/utils/native/haptics";

export type InstallPhase =
  | "linking"
  | "downloading"
  | "verifying"
  | "confirming"
  | "installing"
  | "done"
  | "failed";

export interface InstallJob {
  nativeId: string;
  appId: string;
  phase: InstallPhase;
  bytes: number;
  total: number;
  error: string | null;
}

const jobs = reactive(new Map<string, InstallJob>());
let listeners: Promise<PluginListenerHandle[]> | null = null;
const waiting = new Map<string, (event: InstallEvent) => void>();

/** Registered once for the process: progress and the installer's answers arrive as events. */
function listen(): Promise<PluginListenerHandle[]> {
  listeners ??= Promise.all([
    CapuchooDevice.addListener("downloadProgress", ({ key, bytes, total }) => {
      const job = jobs.get(key);
      if (job && job.phase === "downloading") Object.assign(job, { bytes, total: total || job.total });
    }),
    CapuchooDevice.addListener("installStatus", (event) => {
      if (event.status === "pending_user") return;
      waiting.get(event.packageName)?.(event);
    }),
  ]);
  return listeners;
}

function confirm(title: string, text: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => {
    f7.dialog
      .create({
        title,
        text,
        buttons: [
          { text: f7.params.dialog?.buttonCancel ?? "Cancel", onClick: () => resolve(false) },
          { text: ok, strong: true, cssClass: "dialog-button-danger", onClick: () => resolve(true) },
        ],
        on: { closed: () => resolve(false) },
      })
      .open();
  });
}

export function useInstaller() {
  const { t } = useI18n();

  function fail(job: InstallJob, message: string): void {
    job.phase = "failed";
    job.error = message;
  }

  /** Why Android would refuse this file over what is installed, or null when it will take it. */
  function conflictOf(file: DownloadResult, current: Installed | undefined, installedCert: string | undefined): string | null {
    if (!current?.installed) return null;
    if (current.version_code !== null && current.version_code > file.versionCode)
      return t("install.conflict.downgrade", { installed: current.version_name ?? "", target: file.versionName });
    if (installedCert && file.signingCertSha256 && installedCert !== file.signingCertSha256)
      return t("install.conflict.certificate");
    return null;
  }

  async function install(input: {
    app: App;
    build: NativeBuild;
    identifiers: Identifier[];
    installed: Installed[];
  }): Promise<void> {
    const { app, build } = input;
    if (!can.install(app) || !hasDevice()) return;
    const existing = jobs.get(build.id);
    if (existing && !["done", "failed"].includes(existing.phase)) return;

    const job: InstallJob = { nativeId: build.id, appId: app.id, phase: "linking", bytes: 0, total: build.size_bytes, error: null };
    jobs.set(build.id, job);
    const tracked = jobs.get(build.id)!;
    tick();

    try {
      await listen();
      if (!(await CapuchooDevice.canInstall()).allowed) {
        fail(tracked, t("install.permission.missing"));
        if (await confirm(t("install.permission.title"), t("install.permission.text"), t("install.permission.open")))
          await CapuchooDevice.openInstallSettings();
        return;
      }

      const link = await api.nativeDownload(credentials(), build.id);
      tracked.phase = "downloading";
      const file = await CapuchooDevice.download({
        key: build.id,
        url: link.url,
        ...(build.checksum ? { expectedSha256: build.checksum } : {}),
      });

      tracked.phase = "verifying";
      if (!input.identifiers.some((identifier) => identifier.bundle_id === file.packageName))
        return fail(tracked, t("install.integrity.package", { pkg: file.packageName, app: app.name }));
      if (file.versionCode !== build.version_code)
        return fail(tracked, t("install.integrity.version", { got: file.versionCode, want: build.version_code }));
      if (build.signing_cert_sha256 && file.signingCertSha256 && build.signing_cert_sha256 !== file.signingCertSha256)
        return fail(tracked, t("install.integrity.certificate"));

      const { packages } = await CapuchooDevice.packages({ packageNames: [file.packageName] });
      const current = input.installed.find((row) => row.bundle_id === file.packageName);
      const conflict = conflictOf(file, current, packages[0]?.signingCertSha256);
      if (conflict) {
        tracked.phase = "confirming";
        if (!(await confirm(t("install.conflict.title"), `${conflict} ${t("install.conflict.dataLoss")}`, t("install.conflict.replace"))))
          return fail(tracked, conflict);
        const { uninstalled } = await CapuchooDevice.uninstall({ packageName: file.packageName });
        if (!uninstalled) return fail(tracked, t("install.conflict.kept"));
      }

      tracked.phase = "installing";
      const outcome = await new Promise<InstallEvent>((resolve) => {
        waiting.set(file.packageName, resolve);
        CapuchooDevice.install({ path: file.path }).catch((error: unknown) =>
          resolve({ packageName: file.packageName, status: "failure", message: String(error) }),
        );
      });
      waiting.delete(file.packageName);

      if (outcome.status !== "success")
        return fail(tracked, outcome.status === "aborted" ? t("install.cancelled") : (outcome.message ?? t("install.failed")));

      tracked.phase = "done";
      bump();
      await refreshInstalled();
      await recordActivity(rdb, [
        {
          id: `installed:${build.id}:${Date.now()}`,
          app_id: app.id,
          kind: "installed",
          version_name: build.version_name,
          version_code: build.version_code,
          channel_name: null,
          environment: build.flavour,
          detail: file.packageName,
          created_at: new Date().toISOString(),
          read_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      fail(tracked, error instanceof Error ? error.message : String(error));
    }
  }

  async function cancel(nativeId: string): Promise<void> {
    const job = jobs.get(nativeId);
    if (job?.phase !== "downloading") return;
    await CapuchooDevice.cancelDownload({ key: nativeId }).catch(() => undefined);
    fail(job, t("install.cancelled"));
  }

  function jobFor(nativeId: string): InstallJob | undefined {
    return jobs.get(nativeId);
  }

  function dismiss(nativeId: string): void {
    const job = jobs.get(nativeId);
    if (job && ["done", "failed"].includes(job.phase)) jobs.delete(nativeId);
  }

  return { install, cancel, jobFor, dismiss };
}
