import type { Db } from "../db/database";
import type { Integration, IntegrationKind } from "../db/schema";

export function findIntegration(
  db: Db,
  appId: string,
  kind: IntegrationKind,
): Promise<Integration | undefined> {
  return db
    .selectFrom("integrations")
    .selectAll()
    .where("app_id", "=", appId)
    .where("kind", "=", kind)
    .executeTakeFirst();
}

/** Every app linked to one external project: a GitHub repository id or a GitLab project id. */
export function findIntegrationsByRef(
  db: Db,
  kind: IntegrationKind,
  externalRef: string,
): Promise<Integration[]> {
  return db
    .selectFrom("integrations")
    .selectAll()
    .where("kind", "=", kind)
    .where("external_ref", "=", externalRef)
    .execute();
}

export async function upsertIntegration(
  db: Db,
  input: {
    appId: string;
    kind: IntegrationKind;
    secretHash?: string | null;
    config: Record<string, unknown>;
    externalRef?: string | null;
  },
) {
  const values = {
    app_id: input.appId,
    kind: input.kind,
    config: JSON.stringify(input.config),
    ...(input.secretHash !== undefined ? { secret_hash: input.secretHash } : {}),
    ...(input.externalRef !== undefined ? { external_ref: input.externalRef } : {}),
  };
  const { app_id: _app, kind: _kind, ...update } = values;
  return db
    .insertInto("integrations")
    .values(values)
    .onConflict((oc) =>
      oc.columns(["app_id", "kind"]).doUpdateSet({ ...update, updated_at: new Date() }),
    )
    .returning(["id", "app_id", "kind", "created_at", "last_event_at"])
    .executeTakeFirstOrThrow();
}

export async function setIntegrationCredential(
  db: Db,
  id: string,
  patch: {
    credentialEnc: string | null;
    config?: Record<string, unknown>;
    externalRef?: string | null;
  },
): Promise<void> {
  await db
    .updateTable("integrations")
    .set({
      credential_enc: patch.credentialEnc,
      updated_at: new Date(),
      ...(patch.config ? { config: JSON.stringify(patch.config) } : {}),
      ...(patch.externalRef !== undefined ? { external_ref: patch.externalRef } : {}),
    })
    .where("id", "=", id)
    .execute();
}

export async function touchIntegration(db: Db, id: string, now: Date): Promise<void> {
  await db.updateTable("integrations").set({ last_event_at: now }).where("id", "=", id).execute();
}

export async function touchIntegrations(db: Db, ids: string[], now: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.updateTable("integrations").set({ last_event_at: now }).where("id", "in", ids).execute();
}

export async function deleteIntegration(
  db: Db,
  appId: string,
  kind: IntegrationKind,
): Promise<boolean> {
  const result = await db
    .deleteFrom("integrations")
    .where("app_id", "=", appId)
    .where("kind", "=", kind)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

/** The integration's JSON config as an object; anything else is treated as empty. */
export function integrationConfig(
  integration: Pick<Integration, "config">,
): Record<string, unknown> {
  const raw = integration.config;
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function setIntegrationConfig(
  db: Db,
  id: string,
  config: Record<string, unknown>,
): Promise<void> {
  await db
    .updateTable("integrations")
    .set({ config: JSON.stringify(config), updated_at: new Date() })
    .where("id", "=", id)
    .execute();
}
