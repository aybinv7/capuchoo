import type { Db } from "../db/database";
import type { OrgRole } from "../db/schema";

export function listOrganizationsForUser(db: Db, userId: string, isInstanceAdmin: boolean) {
  let query = db
    .selectFrom("organizations")
    .leftJoin("organization_members as m", (join) =>
      join.onRef("m.organization_id", "=", "organizations.id").on("m.user_id", "=", userId),
    )
    .select([
      "organizations.id",
      "organizations.name",
      "organizations.slug",
      "organizations.created_at",
      "m.role",
    ])
    .orderBy("organizations.name");
  if (!isInstanceAdmin) query = query.where("m.user_id", "is not", null);
  return query.execute();
}

export function findOrganization(db: Db, id: string) {
  return db.selectFrom("organizations").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function memberRole(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<OrgRole | null> {
  const row = await db
    .selectFrom("organization_members")
    .select("role")
    .where("organization_id", "=", organizationId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return row?.role ?? null;
}

export async function createOrganization(
  db: Db,
  input: { name: string; slug: string; ownerId: string },
) {
  return db.transaction().execute(async (trx) => {
    const org = await trx
      .insertInto("organizations")
      .values({ name: input.name, slug: input.slug, updated_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("organization_members")
      .values({ organization_id: org.id, user_id: input.ownerId, role: "owner" })
      .execute();
    return org;
  });
}

export async function slugTaken(db: Db, slug: string): Promise<boolean> {
  const row = await db
    .selectFrom("organizations")
    .select("id")
    .where("slug", "=", slug)
    .executeTakeFirst();
  return Boolean(row);
}

export async function renameOrganization(db: Db, id: string, name: string) {
  return db
    .updateTable("organizations")
    .set({ name, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteOrganization(db: Db, id: string): Promise<void> {
  await db.deleteFrom("organizations").where("id", "=", id).execute();
}

export function listMembers(db: Db, organizationId: string) {
  return db
    .selectFrom("organization_members as m")
    .innerJoin("users", "users.id", "m.user_id")
    .select(["m.user_id", "m.role", "m.created_at", "users.email", "users.full_name"])
    .where("m.organization_id", "=", organizationId)
    .orderBy("users.email")
    .execute();
}

export async function upsertMember(
  db: Db,
  organizationId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  await db
    .insertInto("organization_members")
    .values({ organization_id: organizationId, user_id: userId, role })
    .onConflict((oc) => oc.columns(["organization_id", "user_id"]).doUpdateSet({ role }))
    .execute();
}

export async function removeMember(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("organization_members")
    .where("organization_id", "=", organizationId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function ownerCount(db: Db, organizationId: string): Promise<number> {
  const row = await db
    .selectFrom("organization_members")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("organization_id", "=", organizationId)
    .where("role", "=", "owner")
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function createInvitation(
  db: Db,
  input: {
    organizationId: string;
    email: string;
    role: OrgRole;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
  },
) {
  return db
    .insertInto("invitations")
    .values({
      organization_id: input.organizationId,
      email: input.email,
      role: input.role,
      token_hash: input.tokenHash,
      invited_by: input.invitedBy,
      expires_at: input.expiresAt,
    })
    .returning(["id", "email", "role", "expires_at", "created_at"])
    .executeTakeFirstOrThrow();
}

export function findInvitation(db: Db, tokenHash: string, now: Date) {
  return db
    .selectFrom("invitations")
    .innerJoin("organizations", "organizations.id", "invitations.organization_id")
    .select([
      "invitations.id",
      "invitations.organization_id",
      "invitations.email",
      "invitations.role",
      "invitations.expires_at",
      "organizations.name as organization_name",
    ])
    .where("invitations.token_hash", "=", tokenHash)
    .where("invitations.accepted_at", "is", null)
    .where("invitations.expires_at", ">", now)
    .executeTakeFirst();
}

export function listInvitations(db: Db, organizationId: string, now: Date) {
  return db
    .selectFrom("invitations")
    .select(["id", "email", "role", "created_at", "expires_at"])
    .where("organization_id", "=", organizationId)
    .where("accepted_at", "is", null)
    .where("expires_at", ">", now)
    .orderBy("created_at", "desc")
    .execute();
}

export async function markInvitationAccepted(db: Db, id: string, now: Date): Promise<void> {
  await db.updateTable("invitations").set({ accepted_at: now }).where("id", "=", id).execute();
}

export async function revokeInvitation(
  db: Db,
  organizationId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("invitations")
    .where("organization_id", "=", organizationId)
    .where("id", "=", id)
    .where("accepted_at", "is", null)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
