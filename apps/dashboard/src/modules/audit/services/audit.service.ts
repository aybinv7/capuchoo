import { http } from "@/shared/api/http";
import type { AuditEntry } from "../types/audit.types";

export const AUDIT_PAGE_SIZE = 100;

export const fetchAudit = (appId: string, before: string | undefined, signal?: AbortSignal) =>
  http.get<AuditEntry[]>(`/apps/${appId}/audit`, { limit: AUDIT_PAGE_SIZE, before }, signal);
