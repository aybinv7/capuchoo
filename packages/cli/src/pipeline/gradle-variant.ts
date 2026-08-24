/**
 * Product flavours, and which Gradle variant a deploy should build.
 *
 * A project with `productFlavors` has no `assembleDebug` output at
 * `outputs/apk/debug`: the task builds *every* flavour and writes each to
 * `outputs/apk/<flavour>/<buildType>/`. The pipeline assumed the flavourless
 * layout, so against a real flavoured app (efficy: dev, prod) Gradle succeeded,
 * two APKs were produced, and the deploy failed with "Gradle reported success
 * but no debug APK exists" - having also built a flavour nobody asked for.
 *
 * Choosing the flavour is not something to guess at: the wrong one ships a
 * different applicationId to real devices. So it is inferred only when the
 * project makes it unambiguous, and named explicitly otherwise.
 */

/** Parses the flavour names out of an `android { productFlavors { ... } }` block. */
export function parseProductFlavors(gradle: string): string[] {
  const start = gradle.search(/\bproductFlavors\s*\{/);
  if (start === -1) return [];

  const open = gradle.indexOf("{", start);
  let depth = 0;
  let end = -1;

  for (let i = open; i < gradle.length; i += 1) {
    if (gradle[i] === "{") depth += 1;
    else if (gradle[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];

  const body = gradle.slice(open + 1, end);
  const names: string[] = [];
  let depthInBody = 0;

  // Only identifiers at the top level of the block are flavours; anything
  // nested is that flavour's own configuration.
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (depthInBody === 0) {
      const match = /^([A-Za-z_]\w*)\s*\{/.exec(trimmed);
      if (match?.[1]) names.push(match[1]);
    }

    for (const char of trimmed) {
      if (char === "{") depthInBody += 1;
      else if (char === "}") depthInBody -= 1;
    }
  }

  return names;
}

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** The Gradle task for a variant: `assembleDebug`, or `assembleProdDebug`. */
export function assembleTask(buildType: "debug" | "release", flavor?: string): string {
  const type = capitalise(buildType);
  return flavor ? `assemble${capitalise(flavor)}${type}` : `assemble${type}`;
}

export type FlavorChoice =
  | { kind: "none" }
  | { kind: "chosen"; flavor: string; because: string }
  | { kind: "ambiguous"; flavors: string[] };

/**
 * Which flavour to build.
 *
 * An explicit `--flavor` always wins. Otherwise a single flavour is obvious, and
 * a flavour named after the deploy environment is the documented convention.
 * Anything else is ambiguous and must be asked, not guessed - `staging` against
 * flavours `dev` and `prod` has no right answer.
 */
export function chooseFlavor(input: {
  flavors: string[];
  requested?: string | undefined;
  environment: string;
}): FlavorChoice {
  const { flavors, requested, environment } = input;

  if (requested) return { kind: "chosen", flavor: requested, because: "--flavor" };
  if (flavors.length === 0) return { kind: "none" };
  if (flavors.length === 1) {
    return { kind: "chosen", flavor: flavors[0]!, because: "the only flavour" };
  }

  const match = flavors.find((flavor) => flavor.toLowerCase() === environment.toLowerCase());
  if (match)
    return { kind: "chosen", flavor: match, because: `matches the ${environment} channel` };

  return { kind: "ambiguous", flavors };
}

/** Explains an ambiguous choice, naming the flag that resolves it. */
export function describeAmbiguousFlavor(flavors: string[], environment: string): string {
  return (
    `This project has more than one product flavour (${flavors.join(", ")}) and none is ` +
    `named "${environment}", so which one to build cannot be inferred - and the wrong ` +
    `one ships a different applicationId. Pass --flavor <name>.`
  );
}
