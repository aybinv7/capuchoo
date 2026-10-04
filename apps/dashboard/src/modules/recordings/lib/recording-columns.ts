import type { AnyColumnDef } from "@/shared/components/data-table";
import { formatOffset } from "./activity";
import { startStyle } from "@/shared/recording/start";
import type { RecordingSession } from "../types/recordings.types";

export function sessionDeviceLabel(session: RecordingSession): string {
  const hardware = [session.device?.manufacturer, session.device?.model].filter(Boolean).join(" ");
  return hardware || session.device_id;
}

export const RECORDING_COLUMNS: AnyColumnDef<RecordingSession>[] = [
  {
    id: "started",
    accessorFn: (session) => session.started_at,
    size: 170,
    meta: { title: "Started" },
  },
  {
    id: "device",
    accessorFn: sessionDeviceLabel,
    size: 230,
    meta: { title: "Device" },
  },
  {
    id: "start",
    accessorFn: (session) => session.start,
    size: 130,
    meta: {
      title: "Started by",
      groupable: true,
      groupLabel: (value: string) => startStyle(value).label,
    },
  },
  {
    id: "version",
    accessorFn: (session) => session.version_name,
    sortingFn: "alphanumeric",
    size: 120,
    meta: { title: "Bundle", groupable: true },
  },
  {
    id: "channel",
    accessorFn: (session) => session.channel ?? "",
    size: 120,
    meta: { title: "Channel", groupable: true, groupLabel: (value: string) => value || "unknown" },
  },
  {
    id: "duration",
    accessorFn: (session) => session.duration_ms,
    size: 100,
    meta: {
      title: "Length",
      align: "right",
      exportValue: (session) => formatOffset(session.duration_ms),
    },
  },
  {
    id: "errors",
    accessorFn: (session) => session.error_count,
    size: 90,
    meta: { title: "Errors", align: "right" },
  },
  {
    id: "size",
    accessorFn: (session) => session.size_bytes,
    size: 100,
    meta: { title: "Size", align: "right", defaultHidden: true },
  },
  {
    id: "note",
    accessorFn: (session) => session.note ?? "",
    enableSorting: false,
    size: 280,
    meta: { title: "Note" },
  },
];
