import { http } from "@/shared/api/http";
import type { OrgRole } from "@/shared/types/session";
import type { Invitation, InviteResult, Member } from "../types/settings.types";

const base = (organizationId: string) => `/organizations/${organizationId}`;

export const fetchMembers = (organizationId: string, signal?: AbortSignal) =>
  http.get<Member[]>(`${base(organizationId)}/members`, undefined, signal);

export const fetchInvitations = (organizationId: string, signal?: AbortSignal) =>
  http.get<Invitation[]>(`${base(organizationId)}/invitations`, undefined, signal);

export const inviteMember = (organizationId: string, email: string, role: OrgRole) =>
  http.post<InviteResult>(`${base(organizationId)}/members`, { email, role });

export const changeMemberRole = (organizationId: string, userId: string, role: OrgRole) =>
  http.put<{ user_id: string; role: OrgRole }>(`${base(organizationId)}/members/${userId}`, {
    role,
  });

export const removeMember = (organizationId: string, userId: string) =>
  http.delete(`${base(organizationId)}/members/${userId}`);

export const revokeInvitation = (organizationId: string, invitationId: string) =>
  http.delete(`${base(organizationId)}/invitations/${invitationId}`);

export const renameOrganization = (organizationId: string, name: string) =>
  http.put<{ id: string; name: string }>(base(organizationId), { name });
