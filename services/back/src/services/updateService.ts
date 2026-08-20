import { IUpdateService, UpdateRequest, UpdateResponse, UpdateRecord, StatsRequest } from "@/types";
import supabaseService from "./supabaseService";
import deviceService from "./deviceService";
import { statsVersion } from "./telemetry";
import logger from "@/utils/logger";

class UpdateService implements IUpdateService {
  /**
   * Resolve string App ID (e.g. "com.example.app") to UUID
   */
  async resolveAppUuid(appIdString: string): Promise<string | null> {
    try {
      // 1. Try exact match
      let result = await supabaseService.query("apps", {
        select: "id",
        eq: { app_id: appIdString },
      });
      if (result.data && result.data.length > 0) {
        return result.data[0].id;
      }

      // 2. Try stripping suffixes (e.g. io.aybinv.vuena.staging -> io.aybinv.vuena)
      const suffixes = [".staging", ".dev"];
      for (const suffix of suffixes) {
        if (appIdString.endsWith(suffix)) {
          const baseAppId = appIdString.slice(0, -suffix.length);
          result = await supabaseService.query("apps", {
            select: "id",
            eq: { app_id: baseAppId },
          });
          if (result.data && result.data.length > 0) {
            logger.info(`Resolved App UUID via suffix match: ${appIdString} -> ${baseAppId}`);
            return result.data[0].id;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to resolve app UUID", { appIdString, error });
      return null;
    }
  }

  async getAppConfig(appId: string): Promise<Record<string, any>> {
    const { data: app, error } = await supabaseService
      .getClient()
      .from("apps")
      .select("config")
      .eq("app_id", appId)
      .single();

    if (error || !app) {
      return {};
    }

    return app.config || {};
  }

  private castValue(value: string, type: string): any {
    switch (type) {
      case "number":
        return Number(value);
      case "boolean":
        return value === "true" || value === "1";
      case "json":
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  async resolveEnvConfig(
    appUuid: string,
    environment: string,
    channel: string,
  ): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabaseService
        .getClient()
        .from("app_env_vars")
        .select("key, value, value_type, environment, channel")
        .eq("app_id", appUuid)
        .or(`environment.eq.all,environment.eq.${environment}`)
        .order("environment", { ascending: true });

      if (error || !data) return {};

      const config: Record<string, any> = {};
      const envOrder = { all: 0, dev: 1, staging: 2, prod: 3 };

      const sorted = data.sort((a: any, b: any) => {
        const envDiff =
          (envOrder[a.environment as keyof typeof envOrder] || 0) -
          (envOrder[b.environment as keyof typeof envOrder] || 0);
        if (envDiff !== 0) return envDiff;
        if (!a.channel && b.channel) return -1;
        if (a.channel && !b.channel) return 1;
        return 0;
      });

      for (const row of sorted) {
        if (row.channel && row.channel !== channel) continue;
        config[row.key] = this.castValue(row.value, row.value_type);
      }

      return config;
    } catch (error) {
      logger.error("Failed to resolve env config", { appUuid, error });
      return {};
    }
  }

  async checkForUpdate(request: UpdateRequest): Promise<UpdateResponse> {
    try {
      logger.info("Checking for updates", { request });

      const appUuid = await this.resolveAppUuid(request.appId);
      if (!appUuid) {
        logger.warn("App not found for update check", { appId: request.appId });
        return { message: "App not found" };
      }

      // 1. Get channel metadata - plugin sends defaultChannel (camelCase) or default_channel (snake_case)
      // Priority: explicit channel > defaultChannel > default_channel > fallback to "staging"
      const channelToUse =
        request.channel || request.defaultChannel || (request as any).default_channel || "staging";

      const { data: channelData, error: channelError } = await supabaseService
        .getClient()
        .from("channels")
        .select("id, environment, current_version_id, current_native_version_id")
        .eq("app_id", appUuid)
        .eq("name", channelToUse)
        .maybeSingle();

      if (channelError || !channelData) {
        logger.warn("Channel not found", { channel: channelToUse, appUuid });
        return { message: "Channel not found" };
      }

      const environment = channelData.environment || "staging";

      // 2. Get resolved config from app_env_vars using the channel's environment
      const appConfig = await this.resolveEnvConfig(appUuid, environment, channelToUse);

      // 1.5. Strict Environment Isolation Check
      // Ensure that the requesting App ID matches the Channel's environment matches expectations
      const incomingAppId = request.appId.toLowerCase();
      let expectedEnv = "prod";

      if (incomingAppId.endsWith(".staging")) {
        expectedEnv = "staging";
      } else if (incomingAppId.endsWith(".dev") || incomingAppId.endsWith(".debug")) {
        expectedEnv = "dev";
      }

      // If the channel's environment doesn't match the App ID's type, block it.
      // E.g. Staging App (io.x.staging) -> Should only see Channels with Environment=staging
      // EXCEPTION: Prod apps (io.x) CAN access Staging channels (e.g. for beta testing)
      if (environment !== expectedEnv) {
        // Allow Prod App -> Staging Channel
        if (expectedEnv === "prod" && environment === "staging") {
          // Allowed
        } else {
          logger.warn("Environment mismatch blocked", {
            appId: request.appId,
            channel: channelToUse,
            channelEnv: environment,
            expectedEnv,
          });
          return {
            message: "Environment mismatch",
            config: appConfig,
          };
        }
      }

      // Record the device before any of the "no update" exits below.
      //
      // This used to happen only on a successful OTA delivery, which is the
      // rarest outcome of a check - so a device that was up to date, or on a
      // channel with no bundle, was never recorded at all.
      const device = await this.recordDeviceActivity({
        appUuid,
        request,
        channelId: channelData.id,
      });

      // 3. NATIVE FIRST: Check if there is a newer NATIVE binary available for this channel
      const userNativeVersion = parseInt(request.versionCode || request.versionBuild || "0") || 0;

      const currentVersion =
        request.version_name === "builtin" ? "0.0.0" : request.version_name || "0.0.0";
      // 3. NATIVE FIRST: Check if channel has an explicit NATIVE version assigned
      if (channelData.current_native_version_id) {
        const { data: assignedNative } = await supabaseService
          .getClient()
          .from("native_updates")
          .select("*")
          .eq("id", channelData.current_native_version_id)
          .maybeSingle();

        // If the assigned native version is newer than what user has, force update
        if (
          assignedNative &&
          assignedNative.version_code > userNativeVersion &&
          assignedNative.platform === request.platform
        ) {
          return {
            message: "update_available",
            version_name: assignedNative.version_name,
            url: assignedNative.download_url,
            release_notes: assignedNative.release_notes,
            required: assignedNative.required,
            native_update: { ...assignedNative, type: "native" },
            config: appConfig,
          };
        }
      }

      if (!channelData.current_version_id) {
        logger.info("No active version ID set for channel", {
          channel: channelToUse,
        });
        return { config: appConfig };
      }

      // 4. Get the full channel version data for OTA
      const { data: versionData, error: versionError } = await supabaseService
        .getClient()
        .from("app_versions")
        .select(
          `
          version_name,
          external_url,
          r2_path,
          checksum,
          session_key,
          min_update_version,
          platform
        `,
        )
        .eq("id", channelData.current_version_id)
        .maybeSingle();

      if (versionError || !versionData) {
        logger.info("No active version metadata for channel", {
          channel: channelToUse,
          versionId: channelData.current_version_id,
        });
        return { config: appConfig };
      }

      const latestUpdate = versionData as any;

      // Ensure platform matches if specified
      if (request.platform && latestUpdate.platform !== request.platform) {
        logger.info("Platform mismatch for latest version", {
          expected: request.platform,
          actual: latestUpdate.platform,
        });
        return { config: appConfig };
      }

      // Compare versions - check if latest is actually newer than current
      const isNewer = this.compareVersions(latestUpdate.version_name, currentVersion) > 0;

      if (!isNewer) {
        logger.info("No update needed - already on latest version", {
          currentVersion,
          latestAvailable: latestUpdate.version_name,
          channel: channelToUse,
        });
        return { message: "No update available", config: appConfig };
      }

      // Check if user's native version meets the minimum requirement
      // Note: mapping min_update_version (string) to minNativeRequired
      const minNativeRequired = parseInt(latestUpdate.min_update_version || "0") || 0;

      if (minNativeRequired > 0 && userNativeVersion < minNativeRequired) {
        logger.info("OTA update requires newer native version", {
          userNativeVersion,
          requiredNativeVersion: minNativeRequired,
          otaVersion: latestUpdate.version_name,
          channel: channelToUse,
        });

        // Try to find the actual native update record to help the app
        const { data: nativeUpdate } = await supabaseService
          .getClient()
          .from("native_updates")
          .select("*")
          .eq("platform", request.platform)
          .eq("app_id", appUuid)
          .eq("version_code", minNativeRequired)
          .maybeSingle();

        return {
          message: "native_update_required",
          error: `Native version ${minNativeRequired} required. You have ${userNativeVersion}.`,
          config: appConfig,
          native_update: nativeUpdate || null,
        };
      }

      logger.info("Update found", {
        version_name: latestUpdate.version_name,
        deviceId: request.deviceId,
        channel: channelToUse,
      });

      await this.logUpdateEvent({
        deviceUuid: device?.id,
        appUuid,
        currentVersion,
        newVersion: latestUpdate.version_name,
        platform: request.platform,
        action: "get",
      });

      return {
        version_name: latestUpdate.version_name,
        url: await this.generateDownloadUrl(latestUpdate.external_url || latestUpdate.r2_path),
        checksum: latestUpdate.checksum,
        sessionKey: latestUpdate.session_key || undefined,
        config: appConfig,
      };
      // Nothing follows: every "no update" outcome already returned above.
      // A `logger.info("No updates available")` plus `return {}` used to sit
      // here, unreachable, which is why that log line never appeared.
    } catch (error) {
      logger.error("Update check failed", { request, error });
      throw error;
    }
  }

  /**
   * Upsert the device row and its channel binding.
   *
   * Best-effort by design: a telemetry failure used to surface as a 500 from
   * `/api/update` (or `/api/stats`, where the plugin swallows it silently),
   * which turned a bookkeeping problem into a device that could not update.
   */
  private async recordDeviceActivity(input: {
    appUuid: string;
    request: UpdateRequest;
    channelId: string;
  }): Promise<{ id: string } | null> {
    const { appUuid, request, channelId } = input;
    if (!request.deviceId) return null;

    try {
      const device = await deviceService.registerDevice({
        appUuid,
        deviceId: request.deviceId,
        platform: request.platform,
        channelId,
        versionName: request.version_name,
        versionBuild: request.versionBuild || request.versionCode,
        versionOs: request.versionOs,
        pluginVersion: request.pluginVersion,
        isProd: request.isProd,
        isEmulator: request.isEmulator,
      });

      if (device) {
        await deviceService.linkChannel(device.id, channelId, request.platform);
      }

      return device;
    } catch (error) {
      logger.error("Failed to record device activity", {
        appId: request.appId,
        deviceId: request.deviceId,
        error,
      });
      return null;
    }
  }

  /** Write an `update_logs` row. Never throws - see `recordDeviceActivity`. */
  private async logUpdateEvent(input: {
    deviceUuid?: string | undefined;
    appUuid: string;
    currentVersion?: string | null;
    newVersion?: string | null;
    platform?: string | undefined;
    action: string;
  }): Promise<void> {
    try {
      await supabaseService.insert("update_logs", [
        {
          device_id: input.deviceUuid ?? null,
          app_id: input.appUuid,
          current_version: input.currentVersion ?? null,
          new_version: input.newVersion ?? null,
          platform: input.platform ?? null,
          action: input.action,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      logger.error("Failed to write update log", { input, error });
    }
  }

  async getAllUpdates(query: {
    platform: string;
    appId: string;
    channel?: string;
  }): Promise<{ updates: UpdateRecord[] }> {
    try {
      logger.info("Getting all updates", { query });

      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) {
        return { updates: [] };
      }

      // Query app_versions directly for this app/platform
      // Since app_versions doesn't link to channels directly in new schema,
      // we return all versions for the app if channel is 'stable' or not provided
      const { data, error } = await supabaseService
        .getClient()
        .from("app_versions")
        .select(
          `
          version_name,
          external_url,
          r2_path,
          checksum,
          session_key,
          created_at,
          active,
          required
        `,
        )
        .eq("app_id", appUuid)
        .eq("platform", query.platform)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedUpdates: UpdateRecord[] = (data || []).map((v: any) => ({
        version_name: v.version_name,
        download_url: v.external_url || v.r2_path,
        checksum: v.checksum,
        session_key: v.session_key,
        channel: query.channel || "prod",
        required: v.required,
        active: v.active,
        created_at: v.created_at,
        platform: query.platform as any,
      }));

      return { updates: formattedUpdates };
    } catch (error) {
      logger.error("Get all updates failed", { query, error });
      throw error;
    }
  }

  async logStats(stats: StatsRequest): Promise<void> {
    try {
      const appUuid = await this.resolveAppUuid(stats.appId);
      if (!appUuid) {
        logger.warn("Skipping stats log - App not found", {
          appId: stats.appId,
        });
        return;
      }

      // Accept both 'action' (official) and 'status' (legacy)
      const actionOrStatus = stats.action || stats.status || "unknown";
      const version = statsVersion(stats);

      // The channel the device is actually on: what the caller reported, else
      // the binding stored on the device row.
      //
      // This used to be `.eq("name", "prod")` - a literal. Devices were filed
      // under whatever channel happened to be named `prod` regardless of the
      // channel serving them, and an app without one registered no devices at
      // all.
      const requestedChannelId = stats.channel
        ? await deviceService.resolveChannelId(appUuid, stats.channel)
        : null;

      const device = await deviceService.registerDevice({
        appUuid,
        deviceId: stats.deviceId,
        platform: stats.platform,
        channelId: requestedChannelId,
        versionName: version ?? undefined,
        versionBuild: stats.versionBuild,
        versionOs: stats.versionOs,
        pluginVersion: stats.pluginVersion,
        isProd: stats.isProd,
        isEmulator: stats.isEmulator,
      });

      const channelId = requestedChannelId ?? device?.channel_id ?? null;
      if (device && channelId) {
        await deviceService.linkChannel(device.id, channelId, stats.platform);
      }

      await this.logUpdateEvent({
        deviceUuid: device?.id,
        appUuid,
        currentVersion: stats.oldVersionName ?? null,
        newVersion: version,
        platform: stats.platform,
        action: actionOrStatus,
      });

      logger.info("Stats logged", {
        appId: stats.appId,
        deviceId: stats.deviceId,
        action: actionOrStatus,
        version,
        deviceUuid: device?.id ?? null,
      });
    } catch (error) {
      logger.error("Failed to log stats", { stats, error });
      throw error;
    }
  }

  async assignChannel(assignment: {
    channel: string;
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<void> {
    try {
      const appUuid = await this.resolveAppUuid(assignment.appId);
      if (!appUuid) {
        throw new Error("App not found");
      }

      const channelId = await deviceService.resolveChannelId(appUuid, assignment.channel);
      if (!channelId) {
        throw new Error(`Channel '${assignment.channel}' not found for app`);
      }

      // The device row has to exist first: device_channels.device_id is a
      // foreign key into it, not the plugin's device string.
      const device = await deviceService.registerDevice({
        appUuid,
        deviceId: assignment.deviceId,
        platform: assignment.platform,
        channelId,
        channelOverride: assignment.channel,
      });

      if (!device) {
        throw new Error("Could not register device for channel assignment");
      }

      await deviceService.linkChannel(device.id, channelId, assignment.platform);

      logger.info("Channel assigned", { assignment, deviceUuid: device.id });
    } catch (error) {
      logger.error("Channel assignment failed", { assignment, error });
      throw error;
    }
  }

  async getDeviceChannel(query: {
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<{ channel: string }> {
    try {
      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) return { channel: "prod" };

      // Read the device row directly. The old query filtered
      // `device_channels.device_id` - a UUID column - by the plugin's device
      // string, which matches nothing.
      const { data, error } = await supabaseService
        .getClient()
        .from("devices")
        .select("channel_override, channels ( name )")
        .eq("app_id", appUuid)
        .eq("device_id", query.deviceId)
        .maybeSingle();

      if (error || !data) return { channel: "prod" };

      const channelName = (data.channels as any)?.name;
      return { channel: data.channel_override || channelName || "prod" };
    } catch (error) {
      logger.error("Get device channel failed", { query, error });
      throw error;
    }
  }

  async getAvailableChannels(query: { appId: string; platform: string }): Promise<{
    channels: {
      id: string;
      name: string;
      public?: boolean;
      allow_self_set?: boolean;
    }[];
  }> {
    try {
      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) return { channels: [] };

      const { data, error } = await supabaseService
        .getClient()
        .from("channels")
        .select("id, name, is_public, allow_device_self_set")
        .eq("app_id", appUuid);

      if (error) throw error;

      const channels = (data || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        public: ch.is_public,
        allow_self_set: ch.allow_device_self_set,
      }));

      return { channels };
    } catch (error) {
      logger.error("Get available channels failed", { query, error });
      throw error;
    }
  }

  private async generateDownloadUrl(downloadUrl: string): Promise<string> {
    try {
      // Extract file path from the Supabase URL
      // Example URL: https://dubnvfvlaiqzbimgaqvp.supabase.co/storage/v1/object/public/updates/bundle-android-1.1.120-1759588025070.zip
      const url = new URL(downloadUrl);
      // The path format is typically /storage/v1/object/public/{bucketName}/{filePath}
      const pathParts = url.pathname.split("/");
      const publicIndex = pathParts.indexOf("public");
      if (publicIndex !== -1 && publicIndex < pathParts.length - 1) {
        // Generate a signed URL that's valid for 1 hour (3600 seconds)
        //const filePath = pathParts.slice(publicIndex + 2).join("/"); // Skip 'public' and bucket name
        // const signedUrl =  await supabaseService.createSignedUrl(filePath, 3600);

        return downloadUrl; //signedUrl;
      } else {
        logger.warn("Could not extract file path from download URL", {
          downloadUrl,
        });
        // If we can't parse the URL, return the original URL
        return downloadUrl;
      }
    } catch (error) {
      logger.error("Failed to generate signed URL", { downloadUrl, error });
      // If signing fails, return the original URL
      return downloadUrl;
    }
  }

  /**
   * Compare two semantic version strings
   * @returns positive if v1 > v2, negative if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map((p) => parseInt(p) || 0);
    const parts2 = v2.split(".").map((p) => parseInt(p) || 0);

    // Pad arrays to same length
    const maxLen = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLen) parts1.push(0);
    while (parts2.length < maxLen) parts2.push(0);

    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

export default new UpdateService();
