import type { Db } from "../db/database";

export function findIntegration(db: Db, appId: string, kind: "gitlab") {
  return db
    .selectFrom("integrations")
    .selectAll()
    .where("app_id", "=", appId)
    .where("kind", "=", kind)
    .executeTakeFirst();
}

export async function upsertIntegration(
  db: Db,
  input: { appId: string; kind: "gitlab"; secretHash: string; config: Record<string, unknown> },
) {
  return db
    .insertInto("integrations")
    .values({
      app_id: input.appId,
      kind: input.kind,
      secret_hash: input.secretHash,
      config: JSON.stringify(input.config),
    })
    .onConflict((oc) =>
      oc.columns(["app_id", "kind"]).doUpdateSet({
        secret_hash: input.secretHash,
        config: JSON.stringify(input.config),
      }),
    )
    .returning(["id", "app_id", "kind", "created_at", "last_event_at"])
    .executeTakeFirstOrThrow();
}

export async function touchIntegration(db: Db, id: string, now: Date): Promise<void> {
  await db.updateTable("integrations").set({ last_event_at: now }).where("id", "=", id).execute();
}

export async function deleteIntegration(db: Db, appId: string, kind: "gitlab"): Promise<boolean> {
  const result = await db
    .deleteFrom("integrations")
    .where("app_id", "=", appId)
    .where("kind", "=", kind)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
