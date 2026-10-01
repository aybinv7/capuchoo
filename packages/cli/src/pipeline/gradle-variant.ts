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

export interface FlavorBlock {
  name: string;
  /** What the flavour's own block says, without its nested blocks' braces resolved. */
  body: string;
}

/** The closing brace of the block opened at `open`, or -1. */
function blockEnd(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** `dev {` in Groovy, `create("dev") {` or `register("dev") {` in the Kotlin DSL. */
const FLAVOR_HEADER =
  /^(?:(?:create|register|maybeCreate|getByName)\(\s*["']([A-Za-z_]\w*)["']\s*\)|([A-Za-z_]\w*))\s*\{/;

/** The flavours of an `android { productFlavors { ... } }` block, each with its own body. */
export function parseFlavorBlocks(gradle: string): FlavorBlock[] {
  const start = gradle.search(/\bproductFlavors\s*\{/);
  if (start === -1) return [];

  const open = gradle.indexOf("{", start);
  const end = blockEnd(gradle, open);
  if (end === -1) return [];

  const body = gradle.slice(open + 1, end);
  const blocks: FlavorBlock[] = [];
  let cursor = 0;

  // Only blocks at the top level are flavours; anything nested is a flavour's own configuration.
  while (cursor < body.length) {
    const next = body.indexOf("\n", cursor);
    const lineEnd = next === -1 ? body.length : next;
    const line = body.slice(cursor, lineEnd);
    const brace = line.indexOf("{");
    if (brace === -1) {
      cursor = lineEnd + 1;
      continue;
    }
    const close = blockEnd(body, cursor + brace);
    if (close === -1) break;
    const match = FLAVOR_HEADER.exec(line.trim());
    if (match)
      blocks.push({ name: (match[1] ?? match[2])!, body: body.slice(cursor + brace + 1, close) });
    cursor = close + 1;
  }

  return blocks;
}

/** Parses the flavour names out of an `android { productFlavors { ... } }` block. */
export function parseProductFlavors(gradle: string): string[] {
  return parseFlavorBlocks(gradle).map((block) => block.name);
}

/** A string assignment in either DSL: `key "x"`, `key = "x"`, `key("x")`. */
export function gradleString(source: string, key: string): string | null {
  return new RegExp(`\\b${key}\\s*(?:=\\s*|\\(\\s*)?["']([^"']+)["']`).exec(source)?.[1] ?? null;
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
