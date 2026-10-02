import type { Transaction } from "kysely";
import type { Database, OrgRole } from "../db/schema";
import { DAY, HOUR, type Dice } from "./dice";
import type { PersonKey } from "./context";

export const DEMO_SLUG = "northwind-demo";
export const DEMO_NAME = "Northwind Distribution";

interface Person {
  key: Exclude<PersonKey, "owner">;
  email: string;
  name: string;
  role: OrgRole;
}

const PEOPLE: Person[] = [
  { key: "karim", email: "karim.haddad@northwind.example", name: "Karim Haddad", role: "admin" },
  { key: "ines", email: "ines.duval@northwind.example", name: "Inès Duval", role: "member" },
  { key: "omar", email: "omar.saidi@northwind.example", name: "Omar Saïdi", role: "member" },
  { key: "lea", email: "lea.martin@northwind.example", name: "Léa Martin", role: "member" },
];

/**
 * Removes the previous demo organization and everything under it. Channels point at artefacts
 * and client channels at their base, so pointers are cleared and clients removed first.
 */
export async function resetDemo(trx: Transaction<Database>): Promise<void> {
  const existing = await trx
    .selectFrom("organizations")
    .select("id")
    .where("slug", "=", DEMO_SLUG)
    .executeTakeFirst();
  if (!existing) return;
  const apps = trx.selectFrom("apps").select("id").where("organization_id", "=", existing.id);
  await trx
    .updateTable("channels")
    .set({ current_bundle_id: null, current_native_id: null })
    .where("app_id", "in", apps)
    .execute();
  await trx
    .deleteFrom("channels")
    .where("kind", "=", "client")
    .where("app_id", "in", apps)
    .execute();
  await trx.deleteFrom("organizations").where("id", "=", existing.id).execute();
}

/** The organization, its owner (the admin who asked for the demo) and four fictional colleagues. */
export async function createDemoOrganization(
  trx: Transaction<Database>,
  ownerId: string,
  now: Date,
  dice: Dice,
): Promise<{ organizationId: string; people: Record<PersonKey, string> }> {
  const created = new Date(now.getTime() - 120 * DAY);
  const organization = await trx
    .insertInto("organizations")
    .values({ name: DEMO_NAME, slug: DEMO_SLUG, created_at: created, updated_at: now })
    .returning("id")
    .executeTakeFirstOrThrow();

  const people = { owner: ownerId } as Record<PersonKey, string>;
  for (const person of PEOPLE) {
    const user = await trx
      .insertInto("users")
      .values({
        email: person.email,
        full_name: person.name,
        password_hash: null,
        last_login_at: new Date(now.getTime() - dice.between(1, 30) * HOUR),
        created_at: created,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column("email").doUpdateSet({ full_name: person.name, updated_at: now }),
      )
      .returning("id")
      .executeTakeFirstOrThrow();
    people[person.key] = user.id;
  }

  await trx
    .insertInto("organization_members")
    .values([
      { organization_id: organization.id, user_id: ownerId, role: "owner", created_at: created },
      ...PEOPLE.map((person) => ({
        organization_id: organization.id,
        user_id: people[person.key],
        role: person.role,
        created_at: created,
      })),
    ])
    .execute();
  return { organizationId: organization.id, people };
}
