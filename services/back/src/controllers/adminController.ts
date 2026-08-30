import { Request, Response } from "express";
import { ENVIRONMENTS, isFlavour, type Environment } from "@capuchoo/core";
import { AppError, ConflictError, ValidationError, IFileService, ISupabaseService } from "@/types";
import fileService from "@/services/fileService";
import { assertFlavourMatchesChannel, insertTolerantOfFlavour } from "@/services/flavourGuard";
import { assertNativeGateSatisfiable } from "@/services/nativeGateGuard";
import { SIGNED_URL_TTL_SECONDS, storageKeyFromUrl } from "@/services/signedDownload";
import config from "@/config";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import semver from "semver";
import * as fs from "fs";

/**
 * Controller for handling admin operations including file uploads and dashboard APIs
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AdminController {
  /**
   * Creates an instance of AdminController
   * @param fileService - Service for file operations
   * @param supabaseService - Service for database operations
   */
  constructor(
    private readonly fileService: IFileService,
    private readonly supabaseService: ISupabaseService,
  ) {}

  /**
   * Resolve string App ID (e.g. "com.example.app") to UUID
   */
  private async resolveAppUuid(appIdString: string): Promise<string | null> {
    try {
      const { data: appData, error } = await this.supabaseService
        .getClient()
        .from("apps")
        .select("id")
        .eq("app_id", appIdString)
        .maybeSingle();

      if (error) {
        logger.error("Error resolving app UUID", { appIdString, error });
        return null;
      }

      return appData ? appData.id : null;
    } catch (error) {
      logger.error("Failed to resolve app UUID", { appIdString, error });
      return null;
    }
  }

  /**
   * Upload a new update bundle
   * POST /api/admin/upload
   */
  async uploadBundle(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        version_name,
        platform,
        channel = "prod",
        required = false,
        active = true,
        release_notes = "",
        app_id,
        flavour,
        min_update_version,
      } = req.body;

      const finalVersion = version_name || version;

      logger.info("Upload bundle request received", {
        version: finalVersion,
        platform,
        channel,
        required,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        file: req.file
          ? {
              originalName: req.file.originalname,
              size: req.file.size,
              mimetype: req.file.mimetype,
            }
          : null,
      });

      await this.fileService.validateFile(req.file);

      if (!finalVersion || !platform || !semver.valid(finalVersion)) {
        throw new ValidationError(
          "Missing or invalid parameters: version, platform (semver required)",
        );
      }

      if (["android", "ios", "web"].indexOf(platform) === -1) {
        throw new ValidationError("Invalid platform. Must be: android, ios, web");
      }

      // A build number, despite the column's name.
      //
      // `minimumNativeVersion` in @capuchoo/core parses this with
      // `Number.parseInt` and compares it against the device's `version_code`.
      // A semver string is not merely wrong here - `parseInt("0.6.0")` is 0,
      // which the same function treats as "ungated", so the value that looks
      // most like a version is exactly the one that silently switches the gate
      // off and leaves the release looking published.
      //
      // Validated rather than stored as typed, for that reason.
      const minUpdateVersion =
        min_update_version === undefined || min_update_version === "" ? null : min_update_version;

      if (minUpdateVersion !== null && !/^[0-9]+$/.test(String(minUpdateVersion))) {
        throw new ValidationError(
          `min_update_version is a native build number, not a version name - got ` +
            `"${minUpdateVersion}". Use the versionCode of the binary this bundle needs, ` +
            `for example 10.`,
        );
      }

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      if (!appUuid) {
        throw new ValidationError("Valid App ID is required");
      }

      // Security Check: If API key is scoped to a specific app, ensure it matches
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== appUuid) {
        logger.warn("Security breach attempt: API key app scope mismatch", {
          keyAppId,
          targetAppUuid: appUuid,
          userId: (req as any).user?.id,
        });
        res.status(403).json({
          error: "Forbidden",
          message: "This API key is restricted to another application.",
        });
        return;
      }

      await assertFlavourMatchesChannel(appUuid, channel || "prod", flavour);

      // Before the artefact reaches storage: a bundle gated behind a build the
      // channel does not serve freezes every device on it, silently. Refusing
      // here is the only moment there is someone to tell.
      await assertNativeGateSatisfiable(appUuid, channel || "prod", minUpdateVersion);

      const buffer = req.file!.buffer || fs.readFileSync(req.file!.path);
      const checksum = this.fileService.calculateChecksum(buffer);

      const fileName = `bundles/${appUuid}/${platform}/${channel}/bundle-${platform}-${finalVersion}-${Date.now()}${require("path").extname(
        req.file!.originalname,
      )}`;
      const downloadUrl = await this.fileService.uploadFile(fileName, buffer);

      const updateRecord: any = {
        app_id: appUuid,
        platform: platform as any,
        version_name: finalVersion,
        channel: channel || "prod",
        external_url: downloadUrl,
        checksum,
        required: required === "true" || required === true,
        active: active === "true" || active === true,
        release_notes: release_notes || null,
        // The native build this bundle needs before it may run. The column has
        // always existed and the update decision has always honoured it, but
        // nothing wrote it: no CLI flag, no request field. The one gate that
        // stops a web bundle from landing on a binary too old to run it was
        // unreachable from every supported path.
        ...(minUpdateVersion ? { min_update_version: minUpdateVersion } : {}),
        ...(isFlavour(flavour) ? { flavour } : {}),
      };

      let insertedRecord;
      try {
        insertedRecord = await insertTolerantOfFlavour("app_versions", updateRecord);
      } catch (error) {
        // Re-publishing a version is a client mistake, not a server fault, and
        // the caller can act on it - bump the version, or delete the release.
        // As a 500 with "Upload failed" it read as an outage.
        const message = error instanceof Error ? error.message : String(error);
        if (/duplicate key|already exists|unique constraint/i.test(message)) {
          throw new ConflictError(
            `Version ${finalVersion} has already been published for this app on ` +
              `${platform}. Bump the version, or delete that release first.`,
          );
        }
        throw error;
      }
      const versionId = insertedRecord[0]?.id;

      // Point the channel at what was just uploaded.
      //
      // Without this an upload was never served: /api/update reads
      // `channels.current_version_id`, and nothing ever set it. `deploy ota`
      // reported success, the row landed in app_versions with active: true, and
      // every device kept being told there was no update. `active` on the version
      // row means "this artefact may be served"; the channel pointer is what
      // decides which one *is*.
      let servingChannel: string | null = null;
      const isActive = active === "true" || active === true;

      if (isActive && versionId) {
        const { data: channelRow } = await this.supabaseService
          .getClient()
          .from("channels")
          .select("id, name")
          .eq("app_id", appUuid)
          .eq("name", channel || "prod")
          .maybeSingle();

        if (channelRow) {
          await this.supabaseService.update(
            "channels",
            { current_version_id: versionId, updated_at: new Date().toISOString() },
            { id: channelRow.id },
          );
          servingChannel = channelRow.name;
        } else {
          // Uploading to a channel that does not exist is a configuration
          // mistake worth surfacing, not a silent no-op.
          logger.warn("Uploaded bundle is not being served: channel not found", {
            appUuid,
            channel,
            versionId,
          });
        }
      }

      logger.info("Bundle uploaded successfully", {
        version,
        platform,
        recordId: versionId,
        serving: servingChannel,
      });

      res.json({
        success: true,
        message: servingChannel
          ? `Version ${finalVersion} uploaded and now served on "${servingChannel}"`
          : `Version ${finalVersion} uploaded`,
        downloadUrl,
        fileName,
        serving: servingChannel,
        record: insertedRecord[0],
      });
    } catch (error) {
      logger.error("Bundle upload failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        version: req.body.version,
        platform: req.body.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        file: req.file ? req.file.originalname : undefined,
      });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Upload failed",
          details: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get dashboard statistics
   * GET /api/dashboard/stats?app_id=...
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;

      logger.info("Fetching dashboard statistics", {
        app_id,
        ip: req.ip,
      });

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      // If app_id was provided but not found, return zeroes
      if (app_id && !appUuid) {
        res.json({
          bundles_count: 0,
          devices_count: 0,
          channels_count: 0,
          downloads_count: 0,
        });
        return;
      }

      // 1. Total Bundles (from app_versions)
      let bundlesQuery = this.supabaseService
        .getClient()
        .from("app_versions")
        .select("id", { count: "exact" });
      if (appUuid) bundlesQuery = bundlesQuery.eq("app_id", appUuid);
      const { count: bundlesCount } = await bundlesQuery;

      // 2. Active Devices
      let devicesQuery = this.supabaseService
        .getClient()
        .from("device_channels")
        .select("device_id");
      if (appUuid) devicesQuery = devicesQuery.eq("app_id", appUuid);
      const { data: devicesData } = await devicesQuery;
      const devicesCount = devicesData ? new Set(devicesData.map((d: any) => d.device_id)).size : 0;

      // 3. Total Downloads
      let downloadsQuery = this.supabaseService
        .getClient()
        .from("update_logs")
        .select("id", { count: "exact" })
        .in("action", ["downloaded", "install"]);
      if (appUuid) downloadsQuery = downloadsQuery.eq("app_id", appUuid);
      const { count: downloadsCount } = await downloadsQuery;

      // 4. Active Channels
      let channelsQuery = this.supabaseService
        .getClient()
        .from("channels")
        .select("id", { count: "exact" });
      if (appUuid) channelsQuery = channelsQuery.eq("app_id", appUuid);
      const { count: channelsCount } = await channelsQuery;

      const stats = {
        bundles_count: bundlesCount || 0,
        devices_count: devicesCount || 0,
        channels_count: channelsCount || 0,
        downloads_count: downloadsCount || 0,
      };

      res.json(stats);
    } catch (error) {
      logger.error("Dashboard stats fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  }

  /**
   * Get all bundles for dashboard
   * GET /api/dashboard/bundles
   */
  async getBundles(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;
      const { id } = req.params;

      const identifier = (app_id as string) || id;

      // First resolve the app UUID from bundle identifier if provided
      let appUuid = identifier ? await this.resolveAppUuid(identifier) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      let query = this.supabaseService
        .getClient()
        .from("app_versions")
        .select("*, apps(app_id)")
        .order("created_at", { ascending: false });

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch channels to identify which bundles are currently "active" (live)
      const { data: channels } = await this.supabaseService
        .getClient()
        .from("channels")
        .select("name, current_version_id")
        .eq("app_id", appUuid);

      const bundles =
        (data || []).map((bundle: any) => ({
          id: bundle.id,
          app_id: bundle.app_id,
          app_bundle_id: bundle.apps?.app_id,
          version_name: bundle.version_name,
          download_url: bundle.external_url || bundle.r2_path,
          checksum: bundle.checksum,
          session_key: bundle.session_key,
          channel: bundle.channel || "prod",
          required: bundle.required,
          active: bundle.active,
          created_at: bundle.created_at,
          platform: bundle.platform,
          created_by: bundle.uploaded_by,
          release_notes: bundle.release_notes,
          min_native_version: bundle.min_update_version,
          is_active_for: (channels || [])
            .filter((ch: any) => ch.current_version_id === bundle.id)
            .map((ch: any) => ch.name),
        })) || [];

      res.json(bundles);
    } catch (error) {
      logger.error("Bundles fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  }

  /**
   * Create a new bundle
   * POST /api/dashboard/bundles
   */
  async createBundle(req: Request, res: Response): Promise<void> {
    try {
      const bundleData = req.body;
      const result = await this.supabaseService.insert("app_versions", [bundleData]);
      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("Bundle creation failed", { error });
      res.status(500).json({ error: "Failed to create bundle" });
    }
  }

  /**
   * Update a bundle
   * PUT /api/dashboard/bundles/:id
   */
  async updateBundle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update("app_versions", updateData, {
        id: id,
      });

      if (result.length === 0) {
        throw new ValidationError("Bundle not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Bundle update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update bundle" });
      }
    }
  }

  /**
   * Delete a bundle
   * DELETE /api/dashboard/bundles/:id
   */
  async deleteBundle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("app_versions", { id: id });
      res.status(204).send();
    } catch (error) {
      logger.error("Bundle deletion failed", { error });
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  }

  /**
   * Get all channels for dashboard
   * GET /api/dashboard/channels
   */
  async getChannels(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;
      const { id } = req.params;

      const identifier = (app_id as string) || id;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = identifier ? await this.resolveAppUuid(identifier) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      if (identifier && !appUuid) {
        res.json([]);
        return;
      }

      // 1. Get channels from channels table
      let query = this.supabaseService.getClient().from("channels").select(`
          *,
          app_versions:current_version_id (
            version_name
          )
        `);

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data: channelsData, error: channelsError } = await query;
      if (channelsError) throw channelsError;

      // 2. Get device counts and bundle counts per channel
      const channelIds = (channelsData || []).map((c: any) => c.id);
      const deviceCountsMap: Record<string, number> = {};
      const bundleCountsMap: Record<string, number> = {};

      if (channelIds.length > 0) {
        // Device counts
        const { data: devices } = await this.supabaseService
          .getClient()
          .from("device_channels")
          .select("channel_id")
          .in("channel_id", channelIds);

        (devices || []).forEach((d: any) => {
          deviceCountsMap[d.channel_id] = (deviceCountsMap[d.channel_id] || 0) + 1;
        });

        // Bundle counts per channel name
        const channelNames = (channelsData || []).map((c: any) => c.name);
        const { data: bundles } = await this.supabaseService
          .getClient()
          .from("app_versions")
          .select("channel")
          .in("channel", channelNames);

        (bundles || []).forEach((b: any) => {
          const channelName = b.channel || "prod";
          bundleCountsMap[channelName] = (bundleCountsMap[channelName] || 0) + 1;
        });
      }

      // 3. Format response for frontend
      const result = (channelsData || []).map((c: any) => {
        return {
          ...c,
          bundle_count: bundleCountsMap[c.name] || 0,
          device_count: deviceCountsMap[c.id] || 0,
          current_version: (c.app_versions as any)?.version_name || "None",
        };
      });

      res.json(result);
    } catch (error) {
      logger.error("Channels fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  }

  /**
   * Get all devices for dashboard
   * GET /api/dashboard/devices
   */
  async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      // Read `devices`, not `device_channels`.
      //
      // device_channels holds four columns - device, channel, platform,
      // timestamps - so a dashboard built on it could only ever show four
      // fields, which is why every version column was blank. The device row is
      // the authoritative record and now carries what the app reports.
      let query = this.supabaseService
        .getClient()
        .from("devices")
        .select(
          `
          *,
          channels:channel_id (
            app_id,
            name
          )
        `,
        )
        .order("last_seen", { ascending: false });

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data, error } = await query;
      if (error) throw error;

      const processedDevices =
        (data || []).map((device: any) => ({
          id: device.id,
          device_id: device.device_id,
          app_id: device.app_id || appUuid || app_id,
          platform: device.platform,
          channel: device.channels?.name || device.channel_override || "prod",
          custom_channel: device.channel_override ?? undefined,
          version_name: device.version_name ?? undefined,
          version_build: device.version_build ?? undefined,
          version_os: device.version_os ?? undefined,
          version_builtin: device.version_builtin ?? undefined,
          plugin_version: device.plugin_version ?? undefined,
          is_emulator: device.is_emulator,
          is_prod: device.is_prod,
          custom_id: device.custom_id ?? undefined,
          last_check: device.last_seen,
          created_at: device.created_at,
          updated_at: device.updated_at,
        })) || [];

      res.json(processedDevices);
    } catch (error) {
      logger.error("Devices fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  }

  /**
   * Get statistics data for dashboard
   * GET /api/dashboard/stats-data?app_id=...&range=...
   */
  async getStatsData(req: Request, res: Response): Promise<void> {
    try {
      const { app_id, range = "month" } = req.query;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      // If app_id was provided but not found, return empty
      if (app_id && !appUuid) {
        res.json({ downloads: [], active_users: [] });
        return;
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      if (range === "day") startDate.setDate(now.getDate() - 1);
      else if (range === "week") startDate.setDate(now.getDate() - 7);
      else if (range === "year") startDate.setFullYear(now.getFullYear() - 1);
      else startDate.setMonth(now.getMonth() - 1); // Default to month

      // Fetch stats from update_logs as update_stats may be missing
      let query = this.supabaseService
        .getClient()
        .from("update_logs")
        .select("created_at, action, device_id")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (appUuid) query = query.eq("app_id", appUuid);

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate data by date
      const downloadsMap: Record<string, number> = {};
      const usersMap: Record<string, Set<string>> = {};

      (data || []).forEach((stat: any) => {
        const date = new Date(stat.created_at).toISOString().split("T")[0]!;

        if (stat.action === "downloaded" || stat.action === "install") {
          downloadsMap[date] = (downloadsMap[date] || 0) + 1;
        }

        if (!usersMap[date]) usersMap[date] = new Set();
        usersMap[date]!.add(stat.device_id);
      });

      const downloads = Object.entries(downloadsMap).map(([date, count]) => ({
        date,
        count,
      }));

      const active_users = Object.entries(usersMap).map(([date, set]) => ({
        date,
        count: set.size,
      }));

      res.json({ downloads, active_users });
    } catch (error) {
      logger.error("Stats data fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch statistics data" });
    }
  }

  /**
   * Update device channel
   * PUT /api/dashboard/devices/:id/channel
   */
  async updateDeviceChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { channel } = req.body;

      const result = await this.supabaseService.update(
        "device_channels",
        {
          channel,
          updated_at: new Date().toISOString(),
        },
        { id: parseInt(id!) },
      );

      if (result.length === 0) {
        throw new ValidationError("Device not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Device channel update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update device channel" });
      }
    }
  }

  /**
   * Delete a device
   * DELETE /api/dashboard/devices/:id
   */
  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("device_channels", {
        id: parseInt(id!),
      });
      res.status(204).send();
    } catch (error) {
      logger.error("Device deletion failed", { error });
      res.status(500).json({ error: "Failed to delete device" });
    }
  }

  /**
   * Delete a channel and all associated bundles
   * DELETE /api/dashboard/channels/:id
   */
  async deleteChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { app_id } = req.query;

      // Resolve the app UUID if app_id provided
      const appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      const filter: any = { id };
      if (appUuid) filter.app_id = appUuid;

      await this.supabaseService.delete("channels", filter);
      res.status(204).send();
    } catch (error) {
      logger.error("Channel deletion failed", { error });
      res.status(500).json({ error: "Failed to delete channel" });
    }
  }

  async promoteBundle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { target_app_id, target_channel, password } = req.body;

      if (!target_app_id || !target_channel) {
        throw new ValidationError("target_app_id and target_channel are required");
      }

      // 1. Password Verification for Security
      const user = (req as any).user;
      if (!password) {
        throw new ValidationError("Password is required for promotion");
      }

      const { error: authError } = await this.supabaseService.getClient().auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        logger.warn("Promotion denied: Invalid password", {
          user: user.email,
          itemId: id,
        });
        throw new ValidationError("Invalid password. Promotion denied.");
      }

      const sourceBundle = await this.supabaseService
        .getClient()
        .from("app_versions")
        .select("*")
        .eq("id", id)
        .single();

      let promoteType: "bundle" | "native" = "bundle";
      let sourceData = sourceBundle.data;

      if (sourceBundle.error || !sourceBundle.data) {
        const sourceNative = await this.supabaseService
          .getClient()
          .from("native_updates")
          .select("*")
          .eq("id", id)
          .single();

        if (sourceNative.error || !sourceNative.data) {
          throw new ValidationError("Source bundle or native update not found");
        }
        promoteType = "native";
        sourceData = sourceNative.data;
      }

      const targetApp = await this.supabaseService
        .getClient()
        .from("apps")
        .select("id")
        .eq("app_id", target_app_id)
        .single();

      if (targetApp.error || !targetApp.data) {
        throw new ValidationError("Target app not found");
      }

      const { id: _, created_at: __, updated_at: ___, ...itemData } = sourceData;

      // The gate travels with the bundle - `itemData` is a whole-row copy - and
      // the target channel is a different channel with a different native.
      //
      // This is the one-click version of the problem: promoting dev to prod
      // carries `min_update_version` across and immediately repoints
      // `channels.current_version_id`, so a gate prod cannot satisfy stops every
      // production device updating, with no crash to notice and nothing on the
      // dashboard to see. Checked against the *target* channel, not the source.
      if (promoteType === "bundle") {
        await assertNativeGateSatisfiable(
          targetApp.data.id,
          target_channel,
          sourceData.min_update_version,
        );
      }

      const targetTable = promoteType === "bundle" ? "app_versions" : "native_updates";

      const insertData = {
        ...itemData,
        app_id: targetApp.data.id,
        channel: target_channel,
        // Preserve original created_at to maintain sort order in dashboard (so old pushed versions stay "old")
        created_at: sourceData.created_at,
        updated_at: new Date().toISOString(),
      };

      const upsertOptions: any = {};
      if (promoteType === "native") {
        upsertOptions.onConflict = "app_id, platform, version_code";
      }

      const { data: newItem, error: insertError } = await this.supabaseService
        .getClient()
        .from(targetTable)
        .upsert([insertData], upsertOptions)
        .select();

      if (insertError || !newItem || newItem.length === 0) {
        logger.error(`Failed to promote ${promoteType}`, {
          insertError,
          targetTable,
        });
        throw new Error(`Failed to create promoted ${promoteType}`);
      }

      if (promoteType === "bundle") {
        await this.supabaseService
          .getClient()
          .from("channels")
          .update({
            current_version_id: newItem[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("app_id", targetApp.data.id)
          .eq("name", target_channel);
      } else if (promoteType === "native") {
        await this.supabaseService
          .getClient()
          .from("channels")
          .update({
            current_native_version_id: newItem[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("app_id", targetApp.data.id)
          .eq("name", target_channel);
      }

      res.json(newItem[0]);
    } catch (error) {
      logger.error("Promotion failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to promote item" });
      }
    }
  }
  /**
   * Get a single channel by ID
   * GET /api/dashboard/channels/:id
   */
  async getChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const { data: channel, error } = await this.supabaseService
        .getClient()
        .from("channels")
        .select(
          `
          *,
          app_versions:current_version_id (
            version_name
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error || !channel) {
        throw new ValidationError("Channel not found");
      }

      // Get device count
      const { count: deviceCount } = await this.supabaseService
        .getClient()
        .from("device_channels")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", id);

      const result = {
        ...channel,
        bundle_count: 0, // TODO
        device_count: deviceCount || 0,
        current_version: (channel.app_versions as any)?.version_name || "None",
      };

      res.json(result);
    } catch (error) {
      logger.error("Channel fetch failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch channel" });
      }
    }
  }

  // ============================================================
  // Channels CRUD (Enhanced)
  // ============================================================

  /**
   * Create a new channel
   * POST /api/dashboard/channels
   */
  async createChannel(req: Request, res: Response): Promise<void> {
    try {
      const {
        app_id,
        name,
        environment,
        is_public,
        allow_device_self_set,
        ios_enabled,
        android_enabled,
      } = req.body;

      if (!app_id || !name) {
        throw new ValidationError("app_id and name are required");
      }

      // The environment was silently dropped here. The column defaults to
      // 'staging', so every channel ever created through this endpoint became a
      // staging channel no matter what the caller chose - which is how an app
      // ends up with a channel named "prod" serving staging bundles. It decides
      // which flavour the CLI builds and which bundles the server serves, so it
      // is required rather than defaulted.
      if (!environment || !ENVIRONMENTS.includes(environment as Environment)) {
        throw new ValidationError(
          `environment is required and must be one of: ${ENVIRONMENTS.join(", ")}`,
        );
      }

      // Accept either the bundle identifier or the app's UUID: callers hold one
      // or the other depending on where they got it.
      const appUuid = UUID_PATTERN.test(String(app_id))
        ? String(app_id)
        : await this.resolveAppUuid(app_id as string);

      if (!appUuid) {
        throw new ValidationError("Valid App ID is required");
      }

      const result = await this.supabaseService.insert("channels", [
        {
          app_id: appUuid,
          name,
          environment,
          is_public: is_public ?? false,
          allow_device_self_set: allow_device_self_set ?? false,
          ios_enabled: ios_enabled ?? true,
          android_enabled: android_enabled ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("Channel creation failed", {
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
      });
      // A validation error is the caller's to fix, and its message says how.
      // Collapsing it into a generic 500 turned "you forgot the environment"
      // into a twenty-minute investigation.
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create channel" });
      }
    }
  }

  /**
   * Update a channel
   * PUT /api/dashboard/channels/:id
   */
  async updateChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      // app_id is pulled out to keep it out of the update: a channel does not
      // change which app it belongs to.
      const { app_id: _app_id, ...sanitizedData } = updateData;

      // Ensure empty UUID fields are null
      if (sanitizedData.current_version_id === "") {
        sanitizedData.current_version_id = null;
      }

      const result = await this.supabaseService.update(
        "channels",
        { ...sanitizedData, updated_at: new Date().toISOString() },
        { id },
      );

      if (result.length === 0) {
        throw new ValidationError("Channel not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Channel update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update channel" });
      }
    }
  }

  // ============================================================
  // Update Logs (NEW)
  // ============================================================

  /**
   * Get update logs
   * GET /api/dashboard/update-logs
   * Supports query params: ?app_id=...&device_id=...&limit=100
   */
  async getUpdateLogs(req: Request, res: Response): Promise<void> {
    try {
      const { app_id, device_id, limit = 100 } = req.query;

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      const queryOptions: any = {
        select: "*",
        order: { column: "created_at", ascending: false },
        limit: parseInt(limit as string) || 100,
      };

      if (appUuid || device_id) {
        queryOptions.match = {};
        if (appUuid) queryOptions.match.app_id = appUuid;
        if (device_id) queryOptions.match.device_id = device_id;
      }

      const result = await this.supabaseService.query("update_logs", queryOptions);
      res.json(result.data || []);
    } catch (error) {
      logger.error("Update logs fetch failed", { error });
      res.json([]);
    }
  }

  /**
   * OTA bundles and native binaries in one list, each tagged with which it is.
   * GET /api/dashboard/updates-bundles
   *
   * The dashboard has always asked for this and always got a 404 - the route was
   * never implemented, so its Updates & Bundles page has shown nothing since it
   * was written. The page's own types describe exactly this shape, down to the
   * `type` discriminator its detail view reads from `?type=`.
   *
   * Native rows carry `version_code` and `file_size_bytes`; OTA rows carry
   * `session_key` and `min_native_version`. Both carry `is_active_for`, the
   * channels currently pointing at them, which is what "live" means here - the
   * `active` column only says an artefact *may* be served.
   */
  async getUpdatesAndBundles(req: Request, res: Response): Promise<void> {
    try {
      const identifier = (req.query.app_id as string) || undefined;
      let appUuid = identifier ? await this.resolveAppUuid(identifier) : null;

      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      if (!appUuid) {
        res.status(400).json({ error: "app_id is required" });
        return;
      }

      const client = this.supabaseService.getClient();

      const [bundles, natives, channels] = await Promise.all([
        client
          .from("app_versions")
          .select("*")
          .eq("app_id", appUuid)
          .order("created_at", { ascending: false }),
        client
          .from("native_updates")
          .select("*")
          .eq("app_id", appUuid)
          .order("created_at", { ascending: false }),
        client
          .from("channels")
          .select("name, current_version_id, current_native_version_id")
          .eq("app_id", appUuid),
      ]);

      if (bundles.error) throw bundles.error;
      if (natives.error) throw natives.error;

      const rooms = channels.data ?? [];
      const servingBundle = (id: string) =>
        rooms.filter((ch: any) => ch.current_version_id === id).map((ch: any) => ch.name);
      const servingNative = (id: string) =>
        rooms.filter((ch: any) => ch.current_native_version_id === id).map((ch: any) => ch.name);

      const rows = [
        ...(bundles.data ?? []).map((row: any) => ({
          id: row.id,
          type: "bundle" as const,
          platform: row.platform,
          version_name: row.version_name,
          download_url: row.external_url || row.r2_path,
          checksum: row.checksum,
          session_key: row.session_key,
          channel: row.channel || "prod",
          required: row.required,
          active: row.active,
          created_at: row.created_at,
          created_by: row.uploaded_by,
          release_notes: row.release_notes,
          min_native_version: row.min_update_version,
          is_active_for: servingBundle(row.id),
        })),
        ...(natives.data ?? []).map((row: any) => ({
          id: row.id,
          type: "native" as const,
          platform: row.platform,
          version_name: row.version_name,
          version_code: row.version_code,
          download_url: row.download_url,
          checksum: row.checksum,
          channel: row.channel || "prod",
          required: row.required,
          active: row.active,
          created_at: row.created_at,
          created_by: row.uploaded_by,
          file_size_bytes: row.file_size_bytes,
          release_notes: row.release_notes,
          is_active_for: servingNative(row.id),
        })),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

      res.json(rows);
    } catch (error) {
      logger.error("Updates and bundles fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch updates and bundles" });
    }
  }

  /**
   * A fresh, expiring link to a bundle's artefact.
   * GET /api/dashboard/bundles/:id/download
   *
   * The dashboard used to open `download_url` straight from the row. That was a
   * permanent public URL, and once the bucket was made private it became a 400 -
   * the download button and the copyable config snippet both broke at the moment
   * the storage was secured.
   *
   * So the link is minted per click instead of stored. The dashboard is
   * authenticated and permission-checked, which is exactly what a permanent
   * public URL was not.
   */
  async bundleDownloadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Both kinds share one detail page and one download button, so this looks
      // in both tables. Asked in parallel because an id is in one or the other
      // and a miss on the first should not cost a second round trip.
      const [ota, native] = await Promise.all([
        this.supabaseService.query("app_versions", {
          select: "id, version_name, external_url",
          eq: { id },
        }),
        this.supabaseService.query("native_updates", {
          select: "id, version_name, download_url",
          eq: { id },
        }),
      ]);

      const bundle = ota.data?.[0];
      const binary = native.data?.[0];

      if (!bundle && !binary) {
        res.status(404).json({ error: "No bundle or native update with that id" });
        return;
      }

      const stored = (bundle?.external_url ?? binary?.download_url) as string | null;
      if (!stored) {
        res.status(409).json({ error: "This bundle has no stored artefact" });
        return;
      }

      const key = storageKeyFromUrl(stored, config.supabase.bucketName);

      // Not ours to sign - a release may point at a CDN, and that URL is already
      // whatever its owner intended.
      if (!key) {
        res.json({ url: stored, expiresIn: null });
        return;
      }

      const url = await this.supabaseService.createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
      res.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS });
    } catch (error) {
      logger.error("Bundle download URL failed", { error });
      res.status(500).json({ error: "Could not create a download link" });
    }
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware(): any {
    return this.fileService.createMulterUpload().single("bundle");
  }
}

export default new AdminController(fileService, supabaseService);
