/**
 * The shape of the interactive menu, built from oclif's command registry so it
 * cannot drift. Pure, so the entries and their order are testable.
 */

export interface MenuCommand {
  /** oclif command id, e.g. `deploy:ota`. */
  id: string;
  /** What to show: the last segment, e.g. `ota`. */
  label: string;
  description: string;
  /**
   * Positional arguments the command cannot run without.
   *
   * The menu invokes commands with no argv, so a command with required args
   * failed the moment it was picked - `app grant` answered "Missing 2 required
   * args" and there was no way to supply them. Carried here so the menu can ask.
   */
  requiredArgs: RequiredArg[];
}

export interface RequiredArg {
  name: string;
  description: string;
  /** A closed set, when the command declares one - `role` is admin|developer|... */
  options?: string[] | undefined;
}

export interface MenuTopic {
  name: string;
  description: string;
  commands: MenuCommand[];
}

export interface Menu {
  /** Commands that live under a topic. */
  topics: MenuTopic[];
  /** Commands with no topic, e.g. `doctor`. */
  commands: MenuCommand[];
}

export interface CommandLike {
  id: string;
  description?: string | undefined;
  hidden?: boolean | undefined;
  /**
   * oclif's cached arg metadata, keyed by name.
   *
   * Typed loosely on purpose: this takes `Config#commands`, whose `Arg.Cached`
   * shape is generic over the arg's own value type, and a precise annotation
   * here would make the menu depend on oclif's internals to compile.
   */
  args?: Record<string, { required?: boolean; description?: string; options?: readonly string[] }>;
}

export interface TopicLike {
  name: string;
  description?: string | undefined;
}

/** Never offered: `help` duplicates the menu, and the others are the menu. */
const HIDDEN_IDS = new Set(["", "help", "menu"]);

/**
 * The arguments a command will refuse to run without, in declaration order.
 *
 * Order matters: they are positional, so asking for them out of order would
 * build the wrong command line.
 */
export function requiredArgsOf(command: CommandLike): RequiredArg[] {
  return Object.entries(command.args ?? {})
    .filter(([, arg]) => arg.required === true)
    .map(([name, arg]) => ({
      name,
      description: arg.description ?? "",
      ...(arg.options ? { options: [...arg.options] } : {}),
    }));
}

/** First-session order; everything else follows alphabetically. */
const PRIORITY = ["setup", "init", "doctor", "deploy", "channel", "version", "config"];

function byPriorityThenName(a: string, b: string): number {
  const rankA = PRIORITY.indexOf(a);
  const rankB = PRIORITY.indexOf(b);

  if (rankA !== -1 && rankB !== -1) return rankA - rankB;
  if (rankA !== -1) return -1;
  if (rankB !== -1) return 1;
  return a.localeCompare(b);
}

/** The segment shown in a menu: `deploy:ota` reads as `ota` under `deploy`. */
function lastSegment(id: string): string {
  const parts = id.split(":");
  return parts[parts.length - 1] ?? id;
}

export function buildMenu(input: { commands: CommandLike[]; topics: TopicLike[] }): Menu {
  const visible = input.commands.filter(
    (command) => !command.hidden && !HIDDEN_IDS.has(command.id),
  );

  const describedTopics = new Map(input.topics.map((topic) => [topic.name, topic.description]));

  const grouped = new Map<string, MenuCommand[]>();
  const loose: MenuCommand[] = [];

  for (const command of visible) {
    const entry: MenuCommand = {
      id: command.id,
      label: lastSegment(command.id),
      description: command.description ?? "",
      requiredArgs: requiredArgsOf(command),
    };

    const topic = command.id.includes(":") ? command.id.split(":")[0]! : null;

    if (topic) {
      grouped.set(topic, [...(grouped.get(topic) ?? []), entry]);
    } else {
      loose.push(entry);
    }
  }

  const topics: MenuTopic[] = [...grouped.entries()]
    .map(([name, commands]) => ({
      name,
      // A topic with no description in package.json still has to read as
      // something, so it falls back to its own name rather than an empty line.
      description: describedTopics.get(name) ?? name,
      commands: commands.sort((a, b) => byPriorityThenName(a.label, b.label)),
    }))
    .sort((a, b) => byPriorityThenName(a.name, b.name));

  return {
    topics,
    commands: loose.sort((a, b) => byPriorityThenName(a.label, b.label)),
  };
}

/** How many runnable commands the menu offers, for the header line. */
export function menuSize(menu: Menu): number {
  return menu.commands.length + menu.topics.reduce((total, t) => total + t.commands.length, 0);
}
