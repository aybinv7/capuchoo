import type { PipelineStep } from "@capuchoo/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listBundles, listNativeBuilds } from "../../repositories/artefacts";
import { listBuilds } from "../../repositories/builds";
import { listChannels } from "../../repositories/channels";
import { buildDetail } from "../../services/build-detail";
import { jobLogs } from "../../services/job-logs";
import { appArg, limitArg, uuidArg } from "../args";
import { appAccess, guarded, iso, type ToolContext } from "../context";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const LOG_LINES = 40;
const FAILED_JOBS = 3;

type Kind = "ota" | "native" | "both";

export function registerReleaseTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "list_releases",
    {
      title: "List releases",
      description:
        "Web bundles (OTA) and native builds uploaded for an app, newest first, with the channels serving each.",
      inputSchema: {
        app: appArg,
        kind: z.enum(["ota", "native", "both"]).default("both").describe("Which releases."),
        flavour: z.enum(["dev", "staging", "prod"]).optional().describe("Only one flavour."),
        limit: limitArg(15, 100),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "list_releases",
      async (args: { app: string; kind: Kind; flavour?: string; limit: number }) => {
        const access = await appAccess(ctx, args.app, "viewer", "Reading releases");
        const fetch = Math.min(1000, args.flavour ? args.limit * 4 : args.limit);
        const [bundles, natives, channels] = await Promise.all([
          args.kind !== "native" ? listBundles(ctx.deps.db, access.app.id, fetch) : [],
          args.kind !== "ota" ? listNativeBuilds(ctx.deps.db, access.app.id, fetch) : [],
          listChannels(ctx.deps.db, access.app.id),
        ]);
        const servedBy = (id: string) =>
          channels
            .filter(
              (channel) => channel.current_bundle_id === id || channel.current_native_id === id,
            )
            .map((channel) => channel.name);
        const keep = <T extends { flavour: string | null }>(rows: T[]) =>
          rows.filter((row) => !args.flavour || row.flavour === args.flavour).slice(0, args.limit);
        return {
          ota: keep(bundles).map((bundle) => ({
            id: bundle.id,
            version: bundle.version_name,
            flavour: bundle.flavour,
            platform: bundle.platform,
            min_native_code: bundle.min_native_version,
            uploaded_at: iso(bundle.created_at),
            uploaded_by: bundle.uploaded_by_email ?? null,
            served_by: servedBy(bundle.id),
          })),
          native: keep(natives).map((native) => ({
            id: native.id,
            version: native.version_name,
            version_code: native.version_code,
            flavour: native.flavour,
            platform: native.platform,
            uploaded_at: iso(native.created_at),
            uploaded_by: native.uploaded_by_email ?? null,
            served_by: servedBy(native.id),
          })),
        };
      },
    ),
  );

  server.registerTool(
    "list_builds",
    {
      title: "List builds",
      description:
        "CLI deploys and CI pipeline runs for an app, newest first: status, version, channel, commit and the error when one failed.",
      inputSchema: {
        app: appArg,
        status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional(),
        limit: limitArg(15, 100),
      },
      annotations: READ,
    },
    guarded(ctx, "list_builds", async (args: { app: string; status?: string; limit: number }) => {
      const access = await appAccess(ctx, args.app, "viewer", "Reading builds");
      const rows = await listBuilds(ctx.deps.db, access.app.id, args.status ? 200 : args.limit, {
        topLevel: true,
      });
      return {
        builds: rows
          .filter((row) => !args.status || row.status === args.status)
          .slice(0, args.limit)
          .map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status,
            title: row.title,
            version: row.version_name,
            channel: row.channel_name,
            flavour: row.flavour,
            source: row.source,
            ref: row.ref,
            commit: row.commit_sha?.slice(0, 12) ?? null,
            error: row.error,
            by: row.actor_email,
            started_at: iso(row.started_at),
            finished_at: iso(row.finished_at),
          })),
      };
    }),
  );

  server.registerTool(
    "build_details",
    {
      title: "Build details",
      description:
        "One build or pipeline run: its steps, its jobs, and for each failed job the end of the failing step's log, so the cause can be read without opening CI.",
      inputSchema: {
        build: uuidArg("build"),
        logs: z.boolean().default(true).describe("Read the failing steps' logs from CI."),
      },
      annotations: { ...READ, openWorldHint: true },
    },
    guarded(ctx, "build_details", async (args: { build: string; logs: boolean }) => {
      const detail = await buildDetail(ctx.deps, ctx.principal, args.build);
      const failed = detail.jobs.filter((job) => job.status === "failed").slice(0, FAILED_JOBS);
      const excerpts = args.logs
        ? await Promise.all(
            failed.map(async (job) => {
              const logs = await jobLogs(ctx.deps, ctx.principal, detail.id, job.id).catch(
                () => null,
              );
              if (!logs || !logs.available) {
                return {
                  job: job.name,
                  step: null,
                  log: null,
                  reason: logs?.reason ?? "unavailable",
                };
              }
              const failing = (job.steps as PipelineStep[]).find(
                (step) => step.status === "failed",
              );
              const step =
                logs.steps.find((entry) => failing && entry.number === failing.number) ??
                logs.steps.at(-1);
              const lines = (step?.lines ?? [])
                .filter((line) => line.kind !== "debug")
                .map((line) => line.text);
              return {
                job: job.name,
                step: step?.name ?? null,
                log: lines.slice(-LOG_LINES),
                truncated: lines.length > LOG_LINES,
              };
            }),
          )
        : [];
      return {
        build: {
          id: detail.id,
          kind: detail.kind,
          status: detail.status,
          title: detail.title,
          version: detail.version_name,
          channel: detail.channel_name,
          flavour: detail.flavour,
          ref: detail.ref,
          commit: detail.commit_sha,
          error: detail.error,
          url: detail.pipeline_url ?? detail.job_url,
          started_at: iso(detail.started_at),
          finished_at: iso(detail.finished_at),
        },
        steps: detail.events.map((event) => ({
          step: event.step,
          status: event.status,
          message: event.message,
        })),
        jobs: detail.jobs.map((job) => ({
          id: job.id,
          name: job.name,
          stage: job.stage,
          status: job.status,
        })),
        failed_logs: excerpts,
        children: detail.children.map((child) => ({
          id: child.id,
          status: child.status,
          version: child.version_name,
          error: child.error,
        })),
      };
    }),
  );
}
