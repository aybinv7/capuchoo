import { Request, Response } from "express";
import { ValidationError, IUpdateService } from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";
import { extractStatsRequest } from "@/middleware/fieldNormalizer";

class StatsController {
  constructor(private readonly updateService: IUpdateService) {}

  /**
   * Log statistics from the OTA plugin
   * POST /stats
   *
   * The plugin sends:
   * - action: 'get', 'set', 'download_fail', 'install', 'fail', etc.
   * - app_id, device_id, version_name, version_build, platform
   * - is_emulator, is_prod
   *
   * Legacy code expects 'status' instead of 'action'
   */
  /**
   * Records a batch, and answers 200 unless nothing at all could be stored.
   *
   * One malformed event must not fail the batch. The plugin has no way to send
   * a subset, so a 400 for one bad row would cost every good row beside it -
   * permanently, given how it treats a 4xx. Failures are counted and logged
   * instead, and only a batch where nothing landed is worth a 4xx.
   */
  private async logBatch(req: Request, res: Response, events: unknown[]): Promise<void> {
    let stored = 0;
    const problems: string[] = [];

    for (const event of events) {
      try {
        const raw = (event ?? {}) as Record<string, any>;
        const normalized = extractStatsRequest(raw);

        if (!normalized.deviceId || !normalized.appId || !normalized.platform) {
          problems.push("missing device_id, app_id or platform");
          continue;
        }

        await this.updateService.logStats({
          bundleId: normalized.bundleId,
          action: normalized.action,
          status: normalized.action,
          deviceId: normalized.deviceId,
          appId: normalized.appId,
          platform: normalized.platform,
          version: normalized.version,
          version_name: normalized.version,
          versionBuild: normalized.versionBuild,
          isEmulator: normalized.isEmulator,
          isProd: normalized.isProd,
          ...(raw.channel ? { channel: raw.channel } : {}),
          ...(raw.version_os || raw.versionOs
            ? { versionOs: raw.version_os ?? raw.versionOs }
            : {}),
          ...(raw.plugin_version || raw.pluginVersion
            ? { pluginVersion: raw.plugin_version ?? raw.pluginVersion }
            : {}),
          ...(raw.old_version_name || raw.oldVersionName
            ? { oldVersionName: raw.old_version_name ?? raw.oldVersionName }
            : {}),
        });

        stored += 1;
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }

    logger.info("Logged a stats batch", { received: events.length, stored, problems });

    if (stored === 0 && events.length > 0) {
      res.status(400).json({ error: "No event in the batch could be recorded", problems });
      return;
    }

    res.status(200).json({ status: "success", stored, received: events.length });
  }

  async logStats(req: Request, res: Response): Promise<void> {
    // The plugin batches. `CapgoUpdater.java` builds a `JSONArray` of queued
    // events and posts that, so the body is a bare array and every field this
    // handler reads off `req.body` is undefined - a 400.
    //
    // 400 is fatal to the plugin: `isTransientStatsFailure` retries only 408,
    // 429 and 5xx, so anything else drops the batch and never sends it again.
    //
    //   [CapgoUpdater] 🔴 Dropping stats batch after permanent error
    //
    // Which means every statistic the plugin has ever produced was discarded on
    // arrival - the device's own foreground, background and download events,
    // all of them, silently.
    if (Array.isArray(req.body)) {
      await this.logBatch(req, res, req.body as unknown[]);
      return;
    }

    try {
      // Extract normalized request (handles snake_case and camelCase)
      const normalized = extractStatsRequest(req.body);

      logger.info("Logging statistics", {
        action: normalized.action,
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        version: normalized.version,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Validation - require at minimum deviceId, appId, platform
      if (!normalized.deviceId || !normalized.appId || !normalized.platform) {
        throw new ValidationError("Missing required parameters: device_id, app_id, platform");
      }

      await this.updateService.logStats({
        bundleId: normalized.bundleId,
        action: normalized.action,
        status: normalized.action, // For backwards compatibility
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        version: normalized.version,
        // Everything below was received and then dropped here, which is why
        // the dashboard's device columns were permanently blank.
        version_name: normalized.version,
        versionBuild: normalized.versionBuild,
        isEmulator: normalized.isEmulator,
        isProd: normalized.isProd,
        channel: req.body.channel,
        versionOs: req.body.version_os || req.body.versionOs,
        pluginVersion: req.body.plugin_version || req.body.pluginVersion,
        oldVersionName: req.body.old_version_name || req.body.oldVersionName,
      });

      // Response shape the plugin expects
      res.status(200).json({ status: "success" });
    } catch (error) {
      logger.error("Stats logging failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to log stats" });
      }
    }
  }
}

// Export singleton instance
export default new StatsController(updateService);
