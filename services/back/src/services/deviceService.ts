import supabaseService from "./supabaseService";
import { buildDeviceRow, DeviceObservation } from "./telemetry";
import logger from "@/utils/logger";

/**
 * Device identity and telemetry.
 *
 * `devices` is the table every other telemetry table points at:
 *
 *   device_channels.device_id     UUID NOT NULL REFERENCES devices(id)
 *   update_logs.device_id         UUID          REFERENCES devices(id)
 *   native_update_logs.device_id  UUID          REFERENCES devices(id)
 *
 * Nothing in the backend ever wrote to it, so every one of those inserts failed
 * its foreign key and the dashboard showed zero devices and zero logs -
 * permanently. Two identifiers were also being conflated: the plugin sends a
 * *string* device identifier, while those columns hold `devices.id`, a
 * server-generated UUID. `registerDevice` is the only place that maps one to
 * the other.
 *
 * Every function here is best-effort: telemetry must never break an update
 * check. Failures are logged and reported as `null`, not thrown.
 */

export interface DeviceRow {
  id: string;
  channel_id: string | null;
}

class DeviceService {
  /**
   * Upsert the device on (app_id, device_id) and return its row.
   *
   * `platform` is NOT NULL on the table, so a first sighting without one cannot
   * create the row; we fall back to reading an existing one.
   */
  async registerDevice(observation: DeviceObservation): Promise<DeviceRow | null> {
    if (!observation.appUuid || !observation.deviceId) return null;

    const now = new Date().toISOString();

    try {
      if (!observation.platform) {
        return await this.findDevice(observation.appUuid, observation.deviceId);
      }

      const result = await supabaseService.upsert("devices", buildDeviceRow(observation, now), {
        onConflict: "app_id,device_id",
        select: "id, channel_id",
      });

      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.id) {
        logger.warn("Device upsert returned no row", {
          appUuid: observation.appUuid,
          deviceId: observation.deviceId,
        });
        return null;
      }

      return { id: row.id, channel_id: row.channel_id ?? null };
    } catch (error) {
      logger.error("Failed to register device", {
        appUuid: observation.appUuid,
        deviceId: observation.deviceId,
        error,
      });
      return null;
    }
  }

  async findDevice(appUuid: string, deviceId: string): Promise<DeviceRow | null> {
    try {
      const { data, error } = await supabaseService
        .getClient()
        .from("devices")
        .select("id, channel_id")
        .eq("app_id", appUuid)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (error || !data) return null;
      return { id: data.id, channel_id: data.channel_id ?? null };
    } catch (error) {
      logger.error("Failed to look up device", { appUuid, deviceId, error });
      return null;
    }
  }

  /**
   * Bind a device to a channel.
   *
   * The old code inserted this row only when it did not exist and never updated
   * it, so `updated_at` froze at first contact and a device that moved channel
   * kept its original binding.
   */
  async linkChannel(deviceUuid: string, channelId: string, platform?: string): Promise<void> {
    if (!deviceUuid || !channelId) return;

    try {
      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        device_id: deviceUuid,
        channel_id: channelId,
        updated_at: now,
      };
      if (platform) row.platform = platform;

      await supabaseService.upsert("device_channels", row, {
        onConflict: "device_id,channel_id",
        select: "id",
      });
    } catch (error) {
      logger.error("Failed to link device to channel", { deviceUuid, channelId, error });
    }
  }

  /** Resolve a channel name to its UUID for an app. */
  async resolveChannelId(appUuid: string, channelName: string): Promise<string | null> {
    if (!appUuid || !channelName) return null;

    try {
      const { data, error } = await supabaseService
        .getClient()
        .from("channels")
        .select("id")
        .eq("app_id", appUuid)
        .eq("name", channelName)
        .maybeSingle();

      if (error || !data) return null;
      return data.id;
    } catch (error) {
      logger.error("Failed to resolve channel id", { appUuid, channelName, error });
      return null;
    }
  }
}

export default new DeviceService();
