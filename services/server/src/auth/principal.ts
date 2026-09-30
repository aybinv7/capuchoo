import type { AppRole } from "@capuchoo/core";

export type Credential =
  | { type: "session"; sessionId: string }
  | { type: "api_key"; keyId: string; appId: string | null; role: AppRole | null };

/** Who is calling, and with what credential. */
export interface Principal {
  userId: string;
  email: string;
  fullName: string | null;
  isInstanceAdmin: boolean;
  credential: Credential;
}

/** The API key's app restriction, or null for a session or an unrestricted key. */
export function keyAppRestriction(principal: Principal): string | null {
  return principal.credential.type === "api_key" ? principal.credential.appId : null;
}

/** The API key's role ceiling, or null for a session or an uncapped key. */
export function keyRoleCap(principal: Principal): AppRole | null {
  return principal.credential.type === "api_key" ? principal.credential.role : null;
}

/** Audit columns for whoever acted. */
export function actorColumns(principal: Principal): {
  actor_user_id: string;
  actor_api_key_id: string | null;
} {
  return {
    actor_user_id: principal.userId,
    actor_api_key_id: principal.credential.type === "api_key" ? principal.credential.keyId : null,
  };
}
