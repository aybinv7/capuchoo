import type { Db } from "../db/database";

export interface AuditEntry {
  organizationId?: string | null;
  appId?: string | null;
  actorUserId: string | null;
  actorApiKeyId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db
    .insertInto("audit_log")
    .values({
      organization_id: entry.organizationId ?? null,
      app_id: entry.appId ?? null,
      actor_user_id: entry.actorUserId,
      actor_api_key_id: entry.actorApiKeyId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ip: entry.ip ?? null,
    })
    .execute();
}

export function listAudit(
  db: Db,
  query: {
    appId?: string | undefined;
    organizationId?: string | undefined;
    limit: number;
    before?: string | undefined;
  },
) {
  let base = db
    .selectFrom("audit_log as a")
    .leftJoin("users", "users.id", "a.actor_user_id")
    .select([
      "a.id",
      "a.action",
      "a.target_type",
      "a.target_id",
      "a.details",
      "a.created_at",
      "a.actor_api_key_id",
      "users.email as actor_email",
    ]);
  if (query.appId) base = base.where("a.app_id", "=", query.appId);
  if (query.organizationId) base = base.where("a.organization_id", "=", query.organizationId);
  if (query.before) base = base.where("a.id", "<", query.before);
  return base.orderBy("a.id", "desc").limit(query.limit).execute();
}
