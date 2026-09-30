import type { AnyColumnDef } from "@/shared/components/data-table";
import { actionsColumn } from "@/shared/components/data-table";
import type { ChannelCurrent } from "@/shared/delivery/lib/eligibility";
import type { Channel } from "@/shared/types/release";
import type { ChannelStats } from "@/shared/types/stats";

/** A channel with what it serves and how its fleet is doing, in promotion order. */
export interface ChannelTableRow {
  channel: Channel;
  depth: number;
  current: ChannelCurrent;
  stats: ChannelStats | null;
}

const adoption = (row: ChannelTableRow) =>
  row.stats && row.stats.devices > 0 ? row.stats.on_current / row.stats.devices : null;

export const CHANNEL_COLUMNS: AnyColumnDef<ChannelTableRow>[] = [
  {
    id: "channel",
    accessorFn: (row) => row.channel.name,
    size: 280,
    meta: { title: "Channel" },
  },
  {
    id: "environment",
    accessorFn: (row) => row.channel.environment,
    size: 110,
    meta: { title: "Environment", defaultHidden: true },
  },
  {
    id: "kind",
    accessorFn: (row) => row.channel.kind,
    size: 100,
    meta: {
      title: "Kind",
      defaultHidden: true,
      facetLabel: (value: string) => (value === "client" ? "Client channel" : "Release channel"),
    },
  },
  {
    id: "status",
    accessorFn: (row) => (row.channel.paused ? "paused" : "live"),
    size: 90,
    meta: {
      title: "Status",
      defaultHidden: true,
      facetLabel: (value: string) => (value === "paused" ? "Paused" : "Live"),
    },
  },
  {
    id: "ota",
    accessorFn: (row) => row.current.bundle?.version_name ?? "",
    sortingFn: "alphanumeric",
    size: 130,
    meta: { title: "OTA bundle" },
  },
  {
    id: "native",
    accessorFn: (row) => row.current.native?.version_name ?? "",
    sortingFn: "alphanumeric",
    size: 150,
    meta: {
      title: "Native",
      exportValue: (row) =>
        row.current.native
          ? `${row.current.native.version_name} (${row.current.native.version_code})`
          : null,
    },
  },
  {
    id: "adoption",
    accessorFn: adoption,
    sortUndefined: "last",
    enableGlobalFilter: false,
    size: 170,
    meta: { title: "Adoption" },
  },
  {
    id: "devices",
    accessorFn: (row) => row.stats?.devices ?? 0,
    enableGlobalFilter: false,
    size: 100,
    meta: { title: "Devices", align: "right" },
  },
  {
    id: "active_24h",
    accessorFn: (row) => row.stats?.active_24h ?? 0,
    enableGlobalFilter: false,
    size: 110,
    meta: { title: "Active 24h", align: "right" },
  },
  {
    id: "installs_24h",
    accessorFn: (row) => row.stats?.installs_24h ?? 0,
    enableGlobalFilter: false,
    size: 110,
    meta: { title: "Installs 24h", align: "right" },
  },
  {
    id: "failures_24h",
    accessorFn: (row) => row.stats?.failures_24h ?? 0,
    enableGlobalFilter: false,
    size: 110,
    meta: { title: "Failures 24h", align: "right" },
  },
  actionsColumn<ChannelTableRow>(150),
];
