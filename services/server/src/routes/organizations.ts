import { Hono } from "hono";
import { requireOrgRole } from "../access/app-access";
import { keyAppRestriction, keyRoleCap } from "../auth/principal";
import { INVITE_PREFIX } from "../auth/tokens";
import { baseUrl, readJson, requireString } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { writeAudit } from "../repositories/audit";
import type { OrgRole } from "../db/schema";
import {
  createInvitation,
  createOrganization,
  deleteOrganization,
  findOrganization,
  listInvitations,
  listMembers,
  listOrganizationsForUser,
  memberRole,
  ownerCount,
  removeMember,
  renameOrganization,
  revokeInvitation,
  slugTaken,
  upsertMember,
} from "../repositories/organizations";
import { findUserByEmail } from "../repositories/users";

const ROLES = new Set<OrgRole>(["owner", "admin", "member"]);
const INVITE_DAYS = 7;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "org"
  );
}

function parseRole(value: unknown): OrgRole {
  if (!ROLES.has(value as OrgRole)) throw badRequest("role must be owner, admin or member");
  return value as OrgRole;
}

function audit(
  c: AppContext,
  organizationId: string,
  action: string,
  targetId: string | null,
  details?: Record<string, unknown>,
) {
  const who = principal(c);
  return writeAudit(c.get("deps").db, {
    organizationId,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType: "organization",
    targetId,
    ...(details ? { details } : {}),
    ip: c.get("clientIp"),
  });
}

/** Owners and admins manage members; only an owner grants or removes ownership; the last owner stays. */
export function organizationRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/", async (c) => {
    const who = principal(c);
    const orgs = await listOrganizationsForUser(c.get("deps").db, who.userId, who.isInstanceAdmin);
    return c.json(
      orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.role ?? "owner",
        created_at: org.created_at,
      })),
    );
  });

  router.post("/", async (c) => {
    const who = principal(c);
    if (keyAppRestriction(who) || (keyRoleCap(who) && keyRoleCap(who) !== "admin")) {
      throw forbidden("This API key cannot create organizations.");
    }
    const deps = c.get("deps");
    const body = await readJson(c, 8 * 1024);
    const name = requireString(body.name, "name", 120);
    let slug = slugify(typeof body.slug === "string" ? body.slug : name);
    for (let attempt = 0; await slugTaken(deps.db, slug); attempt += 1) {
      if (attempt > 20) throw conflict("Could not find a free slug for that name");
      slug = `${slugify(name).slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const org = await createOrganization(deps.db, { name, slug, ownerId: who.userId });
    await audit(c, org.id, "organization.create", org.id, { name });
    return c.json({ ...org, role: "owner" }, 201);
  });

  router.get("/:id", async (c) => {
    const who = principal(c);
    const role = await requireOrgRole(c.get("deps").db, who, c.req.param("id"), "member");
    const org = await findOrganization(c.get("deps").db, c.req.param("id"));
    if (!org) throw notFound("Organization");
    return c.json({ ...org, role });
  });

  router.put("/:id", async (c) => {
    const who = principal(c);
    const id = c.req.param("id");
    await requireOrgRole(c.get("deps").db, who, id, "admin");
    const body = await readJson(c, 8 * 1024);
    const org = await renameOrganization(
      c.get("deps").db,
      id,
      requireString(body.name, "name", 120),
    );
    await audit(c, id, "organization.rename", id, { name: org.name });
    return c.json(org);
  });

  router.delete("/:id", async (c) => {
    const who = principal(c);
    const id = c.req.param("id");
    await requireOrgRole(c.get("deps").db, who, id, "owner");
    await deleteOrganization(c.get("deps").db, id);
    return c.body(null, 204);
  });

  router.get("/:id/members", async (c) => {
    const who = principal(c);
    const id = c.req.param("id");
    await requireOrgRole(c.get("deps").db, who, id, "member");
    const members = await listMembers(c.get("deps").db, id);
    return c.json(
      members.map((member) => ({
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        users: { id: member.user_id, email: member.email, full_name: member.full_name },
      })),
    );
  });

  router.post("/:id/members", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const id = c.req.param("id");
    const actorRole = await requireOrgRole(deps.db, who, id, "admin");
    const body = await readJson(c, 8 * 1024);
    const email = requireString(body.email, "email", 255).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("A valid email is required");
    const role = parseRole(body.role ?? "member");
    if (role === "owner" && actorRole !== "owner")
      throw forbidden("Only an owner can add another owner.");

    const user = await findUserByEmail(deps.db, email);
    if (user) {
      const existing = await memberRole(deps.db, id, user.id);
      if (existing === "owner" && actorRole !== "owner")
        throw forbidden("Only an owner can change an owner.");
      await upsertMember(deps.db, id, user.id, role);
      await audit(c, id, "member.add", user.id, { email, role });
      return c.json(
        {
          user_id: user.id,
          role,
          users: { id: user.id, email: user.email, full_name: user.full_name },
        },
        201,
      );
    }

    const token = randomToken(INVITE_PREFIX);
    const invitation = await createInvitation(deps.db, {
      organizationId: id,
      email,
      role,
      tokenHash: sha256Hex(token),
      invitedBy: who.userId,
      expiresAt: new Date(deps.now().getTime() + INVITE_DAYS * 86_400_000),
    });
    await audit(c, id, "member.invite", invitation.id, { email, role });
    return c.json(
      { invitation: { ...invitation, url: `${baseUrl(c)}/invite/${token}`, token } },
      201,
    );
  });

  router.put("/:id/members/:userId", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const id = c.req.param("id");
    const userId = c.req.param("userId");
    const actorRole = await requireOrgRole(deps.db, who, id, "admin");
    const role = parseRole((await readJson(c, 8 * 1024)).role);
    const current = await memberRole(deps.db, id, userId);
    if (!current) throw notFound("Member");
    if ((current === "owner" || role === "owner") && actorRole !== "owner")
      throw forbidden("Only an owner can grant or change ownership.");
    if (current === "owner" && role !== "owner" && (await ownerCount(deps.db, id)) <= 1) {
      throw conflict("An organization keeps at least one owner.", "last_owner");
    }
    await upsertMember(deps.db, id, userId, role);
    await audit(c, id, "member.role", userId, { from: current, to: role });
    return c.json({ user_id: userId, role });
  });

  router.delete("/:id/members/:userId", async (c) => {
    const who = principal(c);
    const deps = c.get("deps");
    const id = c.req.param("id");
    const userId = c.req.param("userId");
    const self = userId === who.userId;
    const actorRole = self
      ? await requireOrgRole(deps.db, who, id, "member")
      : await requireOrgRole(deps.db, who, id, "admin");
    const current = await memberRole(deps.db, id, userId);
    if (!current) throw notFound("Member");
    if (current === "owner" && actorRole !== "owner")
      throw forbidden("Only an owner can remove an owner.");
    if (current === "owner" && (await ownerCount(deps.db, id)) <= 1)
      throw conflict("An organization keeps at least one owner.", "last_owner");
    await removeMember(deps.db, id, userId);
    await audit(c, id, "member.remove", userId, { role: current });
    return c.body(null, 204);
  });

  router.get("/:id/invitations", async (c) => {
    const who = principal(c);
    const id = c.req.param("id");
    await requireOrgRole(c.get("deps").db, who, id, "admin");
    return c.json(await listInvitations(c.get("deps").db, id, c.get("deps").now()));
  });

  router.delete("/:id/invitations/:invitationId", async (c) => {
    const who = principal(c);
    const id = c.req.param("id");
    await requireOrgRole(c.get("deps").db, who, id, "admin");
    if (!(await revokeInvitation(c.get("deps").db, id, c.req.param("invitationId"))))
      throw notFound("Invitation");
    await audit(c, id, "invitation.revoke", c.req.param("invitationId"));
    return c.body(null, 204);
  });

  return router;
}
