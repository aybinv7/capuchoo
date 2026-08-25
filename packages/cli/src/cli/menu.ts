/**
 * The shape of the interactive menu, derived from the commands that exist.
 *
 * Running `capuchoo` with no arguments used to print help and exit, so finding
 * anything meant typing a topic, reading, typing a subcommand, and getting
 * `Error: command channeml not found` for a typo. The menu is a loop instead:
 * pick a topic, pick a command, go back.
 *
 * Built from oclif's own command registry rather than a list written here, so it
 * cannot drift from what the CLI can actually do - a hand-maintained menu is a
 * second source of truth that goes stale the first time someone adds a command.
 *
 * Pure on purpose: an interactive loop cannot be tested without a terminal, but
 * the thing worth testing is which entries appear, under which topic, in which
 * order.
 */

export interface MenuCommand {
  /** oclif command id, e.g. `deploy:ota`. */
  id: string;
  /** What to show: the last segment, e.g. `ota`. */
  label: string;
  description: string;
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
}

export interface TopicLike {
  name: string;
  description?: string | undefined;
}

/**
 * Never offered.
 *
 * `help` duplicates the menu itself, and the empty id is this command - offering
 * "run the menu" from inside the menu is a loop with no purpose.
 */
const HIDDEN_IDS = new Set(["", "help", "menu"]);

/**
 * The order someone actually needs things in, for the entries that have an
 * obvious place in a first session. Everything else follows alphabetically.
 *
 * Alphabetical alone would open with `app` and bury `setup`, which is the one
 * command a new app needs first.
 */
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
