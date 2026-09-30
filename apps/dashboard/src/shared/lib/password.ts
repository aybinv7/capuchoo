/** The server's minimum (`MIN_PASSWORD` in `services/server/src/services/auth-service.ts`). */
export const MIN_PASSWORD_LENGTH = 12;

/** A client-side hint only; the server's `weak_password` refusal is authoritative. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `At least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 256) return "At most 256 characters.";
  return null;
}
