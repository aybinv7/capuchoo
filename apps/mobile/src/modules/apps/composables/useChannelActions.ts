import type { App, Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import { can } from "@/shared/access/capabilities";
import { api } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http";
import { credentials } from "@/shared/session/session";
import { syncApp } from "@/shared/sync/sync";
import { bump } from "@/shared/utils/native/haptics";

function ask(title: string, text: string, ok: string, danger: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    f7.dialog
      .create({
        title,
        text,
        buttons: [
          { text: f7.params.dialog?.buttonCancel ?? "Cancel", onClick: () => resolve(false) },
          { text: ok, strong: true, cssClass: danger ? "dialog-button-danger" : "", onClick: () => resolve(true) },
        ],
        on: { closed: () => resolve(false) },
      })
      .open();
  });
}

/**
 * Delivery from the phone: point a channel at a build, roll it back, pause or resume it. Offered
 * only where `can.deliver` says the server will accept it; the server decides anyway and its
 * refusal - a client channel taking a build its base never served, say - is shown as it is said.
 */
export function useChannelActions(app: Ref<App | null | undefined>) {
  const { t } = useI18n();
  const busy = ref<string | null>(null);

  const allowed = (channel: Channel) => Boolean(app.value && can.deliver(app.value, channel.environment));

  function toast(text: string): void {
    f7.toast.create({ text, closeTimeout: 3200, position: "bottom" }).open();
  }

  async function run(channel: Channel, work: () => Promise<unknown>, done: string): Promise<void> {
    if (!app.value) return;
    busy.value = channel.id;
    try {
      await work();
      bump();
      toast(done);
      await syncApp(app.value.id);
    } catch (error) {
      toast(error instanceof ApiError || error instanceof Error ? error.message : String(error));
    } finally {
      busy.value = null;
    }
  }

  async function deliver(channel: Channel, build: NativeBuild, rollback = false): Promise<void> {
    if (!allowed(channel)) return;
    const version = `${build.version_name} (${build.version_code})`;
    const prod = channel.environment === "prod";
    const confirmed = await ask(
      rollback ? t("deliver.rollbackTitle", { channel: channel.name }) : t("deliver.title", { channel: channel.name }),
      prod ? t("deliver.prodWarning", { version, channel: channel.name }) : t("deliver.text", { version, channel: channel.name }),
      rollback ? t("deliver.rollback") : t("deliver.confirm"),
      prod || rollback,
    );
    if (!confirmed) return;
    await run(
      channel,
      () => api.point(credentials(), channel.id, { native_id: build.id, rollback, reason: t("deliver.reason") }),
      t("deliver.done", { version, channel: channel.name }),
    );
  }

  async function togglePause(channel: Channel): Promise<void> {
    if (!allowed(channel)) return;
    if (channel.paused) {
      await run(channel, () => api.resume(credentials(), channel.id), t("deliver.resumed", { channel: channel.name }));
      return;
    }
    const confirmed = await ask(
      t("deliver.pauseTitle", { channel: channel.name }),
      t("deliver.pauseText"),
      t("deliver.pause"),
      true,
    );
    if (confirmed)
      await run(
        channel,
        () => api.pause(credentials(), channel.id, t("deliver.reason")),
        t("deliver.paused", { channel: channel.name }),
      );
  }

  return { busy, allowed, deliver, togglePause };
}
