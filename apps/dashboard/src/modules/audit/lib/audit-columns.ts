import type { AnyColumnDef } from "@/shared/components/data-table";
import type { AuditEntry } from "../types/audit.types";
import { describeDetails, detailChannel } from "./describe-details";

export const auditActor = (entry: AuditEntry) =>
  entry.actor_email ?? (entry.actor_api_key_id ? "API key" : "system");

export const auditTarget = (entry: AuditEntry) => detailChannel(entry.details) ?? entry.target_type;

/** Audit log columns; details are flattened once per access for search and export. */
export const AUDIT_COLUMNS: AnyColumnDef<AuditEntry>[] = [
  {
    id: "when",
    accessorFn: (entry) => entry.created_at,
    sortingFn: "basic",
    enableGlobalFilter: false,
    size: 130,
    meta: { title: "When" },
  },
  { id: "actor", accessorFn: auditActor, size: 200, meta: { title: "Actor", groupable: true } },
  {
    id: "action",
    accessorFn: (entry) => entry.action,
    size: 190,
    meta: { title: "Action", groupable: true },
  },
  { id: "target", accessorFn: auditTarget, size: 150, meta: { title: "Target", groupable: true } },
  {
    id: "target_id",
    accessorFn: (entry) => entry.target_id ?? "",
    size: 260,
    meta: { title: "Target id", defaultHidden: true },
  },
  {
    id: "details",
    accessorFn: (entry) => describeDetails(entry.details),
    enableSorting: false,
    size: 360,
    meta: { title: "Details", cellClass: "max-w-[28rem] truncate" },
  },
];
