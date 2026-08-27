import {
  decideUpdate,
  describeDecision,
  renderUpdateResponse,
  toAppIdentity,
  type AppIdentity,
  type NativeRelease,
  type OtaRelease,
  type Environment,
  type Platform,
  type UpdateDecision,
} from "@capuchoo/core";
import { IUpdateService, UpdateRequest, UpdateResponse, UpdateRecord, StatsRequest } from "@/types";
import supabaseService from "./supabaseService";
import deviceService from "./deviceService";
import { statsVersion } from "./telemetry";
import logger from "@/utils/logger";

class UpdateService implements IUpdateService {
  /**
   * Resolves a bundle identifier to the app that owns it and the flavour it is.
   *
   * `app_identifiers` first, because that is where the answer is declared. The
   * fallbacks exist so a database mid-migration keeps serving, and both report
   * `flavour: null` - no claim, so no flavour gate. Guessing a flavour is what
   * this replaced.
   */
  async resolveIdentity(bundleId: string): Promise<AppIdentity | null> {
    try {
      const registered = await supabaseService.query("app_identifiers", {
        select: "app_id, bundle_id, platform, flavour",
        eq: { bundle_id: bundleId },
      });

      if (registered.data && registered.data.length > 0) {
        return toAppIdentity(registered.data[0]);
      }
    } catch (error) {
      // The table may not exist yet. Falling through is correct: apps.app_id
      // still resolves every app that has one.
      logger.warn("app_identifiers lookup failed, falling back to apps.app_id", {
        bundleId,
        error,
      });
    }

    try {
      const exact = await supabaseService.query("apps", {
        select: "id",
        eq: { app_id: bundleId },
      });

      if (exact.data && exact.data.length > 0) {
        return { appId: exact.data[0].id, bundleId, flavour: null };
      }

      // Last resort, and deprecated: strip a flavour suffix and look for the
      // base identifier. It is a guess, so it grants no flavour - registering
      // the identifier is what makes it authoritative.
      for (const suffix of [".staging", ".dev"]) {
        if (!bundleId.endsWith(suffix)) continue;

        const base = bundleId.slice(0, -suffix.length);
        const stripped = await supabaseService.query("apps", {
          select: "id",
          eq: { app_id: base },
        });

        if (stripped.data && stripped.data.length > 0) {
          logger.warn("Resolved a bundle identifier by stripping its suffix", {
            bundleId,
            base,
            fix: "Register it: POST /api/apps/:id/identifiers",
          });
          return { appId: stripped.data[0].id, bundleId, flavour: null };
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to resolve a bundle identifier", { bundleId, error });
      return null;
    }
  }

  /** Kept for the callers that only need the uuid. */
  async resolveAppUuid(appIdString: string): Promise<string | null> {
    return (await this.resolveIdentity(appIdString))?.appId ?? null;
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

  /** `environment` may be null: a channel bound to no flavour gets the "all" scope. */
  async resolveEnvConfig(
    appUuid: string,
    environment: string | null,
    channel: string,
  ): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabaseService
        .getClient()
        .from("app_env_vars")
        .select("key, value, value_type, environment, channel")
        .eq("app_id", appUuid)
        .or(`environment.eq.all,environment.eq.${environment ?? "all"}`)
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

  /**
   * Answers `POST /api/update`.
   *
   * Fetch, then decide. The rule itself is `decideUpdate` in `@capuchoo/core`:
   * a pure function over facts, so it can be exercised against a table of cases
   * instead of a physical phone - which is how every defect in it was found
   * before. Nothing in this method branches on versions, environments or
   * platforms. Its only job is to gather what the decision needs, and to
   * perform the side effects the decision implies.
   */
  async checkForUpdate(request: UpdateRequest): Promise<UpdateResponse> {
    try {
      const identity = await this.resolveIdentity(request.appId);
      const appUuid = identity?.appId ?? null;

      // Priority: explicit channel > defaultChannel > default_channel > staging.
      // The plugin sends camelCase; older builds send snake_case.
      const channelName =
        request.channel || request.defaultChannel || (request as any).default_channel || "staging";

      const channel = appUuid ? await this.findChannel(appUuid, channelName) : null;

      // Both need a channel: config is resolved for its environment, and a
      // device row is bound to it.
      const [config, device, native, ota] = await Promise.all([
        appUuid && channel
          ? this.resolveEnvConfig(appUuid, channel.environment, channelName)
          : Promise.resolve({}),
        // Recorded before any of the "nothing to do" outcomes. This used to
        // happen only on a successful OTA delivery - the rarest outcome of a
        // check - so a device that was up to date, or on a channel with no
        // bundle, was never recorded at all.
        appUuid && channel
          ? this.recordDeviceActivity({ appUuid, request, channelId: channel.id })
          : Promise.resolve(null),
        channel ? this.findAssignedNative(channel.currentNativeVersionId) : Promise.resolve(null),
        channel ? this.findAssignedBundle(channel.currentVersionId) : Promise.resolve(null),
      ]);

      const platform = (request.platform || "android") as Platform;

      const decision = decideUpdate({
        device: {
          appId: request.appId,
          platform,
          versionCode: Number.parseInt(request.versionCode || request.versionBuild || "0", 10) || 0,
          // The sentinel for "no bundle has ever been applied". It is not a
          // semantic version, and the decision sorts it behind every release.
          versionName: request.version_name || "builtin",
          // Straight through from the plugin's is_prod / is_emulator, which the
          // field normalizer has already camelCased. Left undefined when the
          // device did not report - the decision must not read silence as false.
          isProduction: typeof request.isProd === "boolean" ? request.isProd : undefined,
          isEmulator: typeof request.isEmulator === "boolean" ? request.isEmulator : undefined,
        },
        identity,
        channel: channel
          ? {
              name: channel.name,
              environment: channel.environment,
              allowDevBuilds: channel.allowDevBuilds,
              allowEmulators: channel.allowEmulators,
              iosEnabled: channel.iosEnabled,
              androidEnabled: channel.androidEnabled,
            }
          : null,
        native,
        ota,
      });

      // One line per check naming the branch that fired. The previous
      // implementation logged only some outcomes, and its "no updates
      // available" line sat after an unconditional return, so it never once
      // appeared in production.
      logger.info("Update decision", {
        appId: request.appId,
        channel: channelName,
        deviceId: request.deviceId,
        outcome: decision.kind,
        detail: describeDecision(decision),
      });

      if (decision.kind === "ota" && appUuid) {
        await this.logUpdateEvent({
          deviceUuid: device?.id,
          appUuid,
          currentVersion: request.version_name,
          newVersion: decision.release.version_name,
          platform: request.platform,
          action: "get",
        });
      }

      return renderUpdateResponse(decision, {
        config,
        gate: await this.findGateNative(decision, appUuid, platform),
      });
    } catch (error) {
      logger.error("Update check failed", { request, error });
      throw error;
    }
  }

  /** The channel a check names, with the two pointers that decide what it serves. */
  private async findChannel(
    appUuid: string,
    name: string,
  ): Promise<{
    id: string;
    name: string;
    environment: Environment | null;
    allowDevBuilds: boolean;
    allowEmulators: boolean;
    iosEnabled: boolean;
    androidEnabled: boolean;
    currentVersionId: string | null;
    currentNativeVersionId: string | null;
  } | null> {
    const { data, error } = await supabaseService
      .getClient()
      .from("channels")
      // One literal: supabase-js infers the row type from the string, and a
      // concatenation defeats that - every column comes back as an error type.
      // prettier-ignore
      .select(
        "id, environment, allow_dev, allow_emulator, ios_enabled, android_enabled, current_version_id, current_native_version_id",
      )
      .eq("app_id", appUuid)
      .eq("name", name)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name,
      // Passed through as it is, including null. It used to default to
      // "staging", which was a guess kept only to make the old suffix rule
      // workable; a channel bound to no flavour now gates on none.
      environment: (data.environment as Environment | null) ?? null,
      // The columns have existed since the first schema and nothing read them,
      // so a channel marked allow_emulator: false served every emulator that
      // asked. Absent reads as permissive, matching the column defaults.
      allowDevBuilds: data.allow_dev !== false,
      allowEmulators: data.allow_emulator !== false,
      iosEnabled: data.ios_enabled !== false,
      androidEnabled: data.android_enabled !== false,
      currentVersionId: data.current_version_id ?? null,
      currentNativeVersionId: data.current_native_version_id ?? null,
    };
  }

  /**
   * The native binary a channel points at.
   *
   * `channels.current_native_version_id` is what decides this, not the row's
   * own `active` flag - that only means "publishable". The pointer was never
   * written on publish, so a native release existed, was marked active, and
   * nothing ever served it.
   */
  private async findAssignedNative(versionId: string | null): Promise<NativeRelease | null> {
    if (!versionId) return null;

    const { data, error } = await supabaseService
      .getClient()
      .from("native_updates")
      .select(
        "version_name, version_code, download_url, platform, required, release_notes, file_size_bytes",
      )
      .eq("id", versionId)
      .maybeSingle();

    if (error || !data) return null;

    return { ...data, platform: data.platform as Platform } as NativeRelease;
  }

  /** The OTA bundle a channel points at, with its URL already resolved. */
  private async findAssignedBundle(versionId: string | null): Promise<OtaRelease | null> {
    if (!versionId) return null;

    const { data, error } = await supabaseService
      .getClient()
      .from("app_versions")
      .select(
        "version_name, external_url, r2_path, checksum, session_key, min_update_version, platform, required, release_notes",
      )
      .eq("id", versionId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      version_name: data.version_name,
      url: await this.generateDownloadUrl(data.external_url || data.r2_path),
      platform: data.platform as Platform,
      checksum: data.checksum,
      session_key: data.session_key,
      min_update_version: data.min_update_version,
      required: data.required,
      release_notes: data.release_notes,
    };
  }

  /**
   * The binary that satisfies a bundle's `min_update_version`.
   *
   * Only looked up when the decision is that one is needed, and null when the
   * publisher gated a bundle behind a build they never uploaded - which the
   * response reports rather than treating as an error.
   */
  private async findGateNative(
    decision: UpdateDecision,
    appUuid: string | null,
    platform: Platform,
  ): Promise<NativeRelease | null> {
    if (decision.kind !== "native-required" || !appUuid) return null;

    const { data, error } = await supabaseService
      .getClient()
      .from("native_updates")
      .select(
        "version_name, version_code, download_url, platform, required, release_notes, file_size_bytes",
      )
      .eq("app_id", appUuid)
      .eq("platform", platform)
      .eq("version_code", decision.minVersionCode)
      .maybeSingle();

    if (error || !data) return null;

    return { ...data, platform: data.platform as Platform } as NativeRelease;
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
        versionBuiltin: request.versionBuiltin,
        pluginVersion: request.pluginVersion,
        isProd: request.isProd,
        isEmulator: request.isEmulator,
        customId: request.customId,
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
}

export default new UpdateService();
