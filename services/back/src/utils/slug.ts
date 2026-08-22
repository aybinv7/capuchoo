/**
 * URL slugs for organizations.
 *
 * `organizations.slug` is UNIQUE NOT NULL, and both creation paths - the
 * onboarding wizard and `POST /api/organizations` - were sending a name and no
 * slug. The wizard's insert therefore failed outright, and the endpoint rejected
 * the dashboard's payload with "Name and slug are required" for a field the
 * dashboard has no input for.
 *
 * Deriving it is the right default: a slug is a formatting of the name, not a
 * separate decision. An explicit one is still accepted.
 */

/** Lowercase, ASCII, hyphen-separated. Empty when the name has nothing usable. */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      // Strip accents so "Café" becomes "cafe" rather than "caf".
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90)
  );
}

/**
 * Append a numeric suffix until the slug is free.
 *
 * `taken` is asked in a loop rather than given a list, so the caller decides how
 * to check - a query, a cached set - without this function knowing.
 */
export async function uniqueSlug(
  name: string,
  taken: (candidate: string) => Promise<boolean>,
  fallback = "org",
): Promise<string> {
  const base = slugify(name) || fallback;

  if (!(await taken(base))) return base;

  // Bounded: an organisation name colliding 50 times is a different problem,
  // and an unbounded loop against a database is not the way to find out.
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }

  throw new Error(`Could not find a free slug for "${name}"`);
}
