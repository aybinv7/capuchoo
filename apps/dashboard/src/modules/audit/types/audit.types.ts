/** One row of `GET /api/apps/:id/audit`. */
export interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | string | null;
  created_at: string;
  actor_api_key_id: string | null;
  actor_email: string | null;
}
