const SETUP_ERRORS: Record<string, string> = {
  expired: "The GitHub link took too long. Start the installation again.",
  signed_out: "Your Capuchoo session ended during the installation. Sign in and try again.",
  requested:
    "GitHub sent the installation to an owner of that account for approval. It links here once they accept.",
  no_installation: "GitHub did not return an installation. Install the App and pick an account.",
  unverified: "GitHub could not confirm you can see that installation, so it was not linked.",
  forbidden: "Linking an installation needs the admin role in this organization.",
  not_yours: "Your GitHub account cannot see that installation, so it was not linked.",
  failed: "GitHub did not complete the installation. Try again.",
};

const MANIFEST_ERRORS: Record<string, string> = {
  expired: "The GitHub App setup took too long. Create the App again.",
  signed_out: "Your Capuchoo session ended while GitHub created the App. Sign in and retry.",
  forbidden: "Only an instance administrator can create the GitHub App.",
  failed: "GitHub did not hand the App back to Capuchoo. Try again.",
};

/** A person's sentence for `?github_error=` after installing the App. */
export const installErrorMessage = (reason: string): string =>
  SETUP_ERRORS[reason] ?? `GitHub returned "${reason}". Try the installation again.`;

/** A person's sentence for `?error=` after the App manifest flow. */
export const manifestErrorMessage = (reason: string): string =>
  MANIFEST_ERRORS[reason] ?? `Creating the App failed (${reason}). Try again.`;

/**
 * The manifest form posts to GitHub, so only a GitHub address is accepted as its target - the
 * CSP's `form-action` would refuse anything else anyway, but silently.
 */
export function isGithubFormAction(action: string): boolean {
  try {
    const url = new URL(action);
    return url.protocol === "https:" && url.hostname === "github.com";
  } catch {
    return false;
  }
}
