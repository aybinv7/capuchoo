import type { OrgRole } from "@/shared/types/session";

/** `GET /api/auth/invitations/:token`. */
export interface InvitationPreview {
  email: string;
  role: OrgRole;
  organization: string;
  expires_at: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  full_name: string | null;
}
