/**
 * A row of `update_logs`, as the backend returns it.
 *
 * This is the table, not a wish. It previously declared `timestamp`, `ip` and
 * `user_agent`, none of which exist - so every row in the dashboard rendered
 * "Invalid Date" twice, once for the relative time and once for the absolute,
 * because `new Date(undefined)` is what `log.timestamp` evaluated to. The
 * search box filtered on `log.ip` for the same reason and matched nothing.
 *
 * `/dashboard/update-logs` does `select: "*"`, so the shape here is exactly the
 * column list in `scripts/schema.sql`.
 */
export interface UpdateLog {
  id: string;
  /** `devices.id` - a UUID, not the plugin's device string. Null when unresolved. */
  device_id: string | null;
  app_id: string;
  /**
   * Constrained by `update_logs_action_check`, widened by migration 003. Kept
   * in step with that constraint deliberately: a value outside it is rejected
   * by Postgres, so offering one as a filter would advertise something the
   * database can never contain.
   */
  action:
    | "get"
    | "set"
    | "install"
    | "download"
    | "download_complete"
    | "download_fail"
    | "download_failed"
    | "update_fail"
    | "update_failed"
    | "app_ready"
    | "app_moved_to_background"
    | "app_moved_to_foreground"
    | "update_available"
    | "native_update_required"
    | "no_update_available"
    | "unknown"
    | "blocked_by_server_url";
  current_version: string | null;
  new_version: string | null;
  platform: "android" | "ios" | null;
  status: "success" | "failed" | "pending" | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  /** The column is `created_at`. There is no `timestamp`. */
  created_at: string;
}
