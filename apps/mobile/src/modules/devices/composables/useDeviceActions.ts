import type { App, Channel } from "@/domains/catalog/catalog.repository";
import { deleteDeviceRow, type Device } from "@/domains/insights/insights.repository";
import { can } from "@/shared/access/capabilities";
import { api } from "@/shared/api/endpoints";
import { rdb } from "@/shared/database";
import { credentials } from "@/shared/session/session";
import { syncDevices } from "@/shared/sync/insights";
import { bump } from "@/shared/utils/native/haptics";

/**
 * Overriding a device's channel and forgetting a device, offered only where the server would
 * accept it. The server still decides, and its refusal is shown as it is said.
 */
export function useDeviceActions(app: Ref<App | null | undefined>) {
  const { t } = useI18n();
  const busy = ref(false);

  const canAssign = (channel: Channel | null) =>
    Boolean(app.value && can.assignDevice(app.value, channel ? channel.environment : undefined));
  const canRemove = computed(() => Boolean(app.value && can.removeDevice(app.value)));

  function toast(text: string): void {
    f7.toast.create({ text, closeTimeout: 3200, position: "bottom" }).open();
  }

  async function run(work: () => Promise<unknown>, done: string): Promise<boolean> {
    busy.value = true;
    try {
      await work();
      bump();
      toast(done);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function assign(device: Device, channel: Channel | null): Promise<void> {
    if (!canAssign(channel) || busy.value) return;
    await run(
      async () => {
        await api.assignDevice(credentials(), device.id, channel?.id ?? null);
        await syncDevices(device.app_id);
      },
      channel ? t("device.assigned", { channel: channel.name }) : t("device.unassigned"),
    );
  }

  function remove(device: Device, title: string): Promise<boolean> {
    if (!canRemove.value || busy.value) return Promise.resolve(false);
    return new Promise((resolve) => {
      let confirmed = false;
      f7.dialog
        .create({
          title: t("device.removeTitle", { device: title }),
          text: t("device.removeText"),
          buttons: [
            { text: t("common.cancel") },
            {
              text: t("device.remove"),
              strong: true,
              cssClass: "dialog-button-danger",
              onClick: () => {
                confirmed = true;
                void run(async () => {
                  await api.removeDevice(credentials(), device.id);
                  await deleteDeviceRow(rdb, device.id);
                }, t("device.removed")).then(resolve);
              },
            },
          ],
          on: { closed: () => !confirmed && resolve(false) },
        })
        .open();
    });
  }

  return { busy, canAssign, canRemove, assign, remove };
}
