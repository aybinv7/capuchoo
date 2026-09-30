import { http } from "@/shared/api/http";
import type { IssuedSession } from "@/shared/types/session";
import type { AcceptInvitationInput, Credentials, InvitationPreview } from "../types/auth.types";

export const login = (credentials: Credentials) =>
  http.post<IssuedSession>("/auth/login", credentials);

export const fetchInvitation = (token: string, signal?: AbortSignal) =>
  http.get<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`, undefined, signal);

export const acceptInvitation = (input: AcceptInvitationInput) =>
  http.post<IssuedSession>("/auth/invitations/accept", input);
