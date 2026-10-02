import type { AnyColumnDef } from "@/shared/components/data-table";
import type { Build } from "@/shared/types/build";

export const buildActor = (build: Build) =>
  build.actor_email ?? (build.actor_api_key_id ? "API key" : "");

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const BUILD_COLUMNS: AnyColumnDef<Build>[] = [
  {
    id: "status",
    accessorFn: (build) => build.status,
    size: 120,
    meta: {
      title: "Status",
      groupable: true,
      facetLabel: (value: string) => STATUS_LABELS[value] ?? value,
    },
  },
  {
    id: "kind",
    accessorFn: (build) => build.kind,
    size: 90,
    meta: { title: "Kind", defaultHidden: true, groupable: true },
  },
  {
    id: "release",
    accessorFn: (build) =>
      build.kind === "pipeline"
        ? [build.title, build.workflow, build.trigger].filter(Boolean).join(" ")
        : (build.version_name ?? ""),
    sortingFn: "alphanumeric",
    size: 240,
    meta: {
      title: "Release",
      exportValue: (build) =>
        build.kind === "pipeline"
          ? (build.title ?? build.workflow)
          : build.version_name
            ? `${build.version_name}${build.version_code ? ` (${build.version_code})` : ""}`
            : null,
    },
  },
  {
    id: "channel",
    accessorFn: (build) => build.channel_name ?? build.target_channel_names?.join(", ") ?? "",
    size: 160,
    meta: { title: "Channel", groupable: true },
  },
  {
    id: "flavour",
    accessorFn: (build) => build.flavour ?? "",
    size: 100,
    meta: { title: "Flavour", defaultHidden: true, groupable: true },
  },
  {
    id: "source",
    accessorFn: (build) => [build.source, build.ref, build.commit_sha].filter(Boolean).join(" "),
    enableSorting: false,
    size: 280,
    meta: { title: "Source" },
  },
  { id: "actor", accessorFn: buildActor, size: 180, meta: { title: "By", groupable: true } },
  {
    id: "started",
    accessorFn: (build) => build.started_at ?? build.created_at,
    sortingFn: "basic",
    enableGlobalFilter: false,
    size: 120,
    meta: { title: "Started", align: "right" },
  },
  {
    id: "duration",
    accessorFn: (build) => {
      const from = Date.parse(build.started_at ?? build.created_at);
      const to = build.finished_at ? Date.parse(build.finished_at) : Number.NaN;
      return Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, to - from) : null;
    },
    sortUndefined: "last",
    enableGlobalFilter: false,
    size: 110,
    meta: { title: "Duration", align: "right" },
  },
  {
    id: "error",
    accessorFn: (build) => build.error ?? "",
    enableSorting: false,
    size: 280,
    meta: { title: "Error", defaultHidden: true, cellClass: "max-w-80 truncate" },
  },
];
