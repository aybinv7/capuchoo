import { describe, expect, it } from "vite-plus/test";
import { buildMenu, menuSize, requiredArgsOf, type CommandLike } from "./menu.js";

/** The real registry, as oclif reports it. */
const COMMANDS: CommandLike[] = [
  { id: "", description: "the menu itself" },
  { id: "app:delete", description: "Delete an app" },
  { id: "app:list", description: "List apps" },
  { id: "auth:login", description: "Sign in" },
  { id: "auth:logout", description: "Sign out" },
  { id: "auth:whoami", description: "Show the signed-in account" },
  { id: "channel:create", description: "Create a channel" },
  { id: "channel:delete", description: "Delete a channel" },
  { id: "channel:list", description: "List channels" },
  { id: "config:list", description: "Show resolved configuration" },
  { id: "config:set", description: "Set a configuration value" },
  { id: "deploy:native", description: "Publish a native binary" },
  { id: "deploy:ota", description: "Publish a web bundle" },
  { id: "doctor", description: "Check this app is usable" },
  { id: "help", description: "Display help" },
  { id: "init", description: "Link this directory to an app" },
  { id: "org:create", description: "Create an organization" },
  { id: "org:list", description: "List organizations" },
  { id: "setup", description: "Install everything this app needs" },
  { id: "version:bump", description: "Bump the version" },
  { id: "version:sync", description: "Sync version numbers" },
];

const TOPICS = [
  { name: "app", description: "List and delete apps" },
  { name: "auth", description: "Sign in to a Capuchoo backend" },
  { name: "channel", description: "Create and inspect an app's channels" },
  { name: "config", description: "Inspect resolved configuration" },
  { name: "deploy", description: "Build and publish a release" },
  { name: "org", description: "Create and list organizations" },
  { name: "version", description: "Manage the app version" },
];

const menu = buildMenu({ commands: COMMANDS, topics: TOPICS });

describe("buildMenu", () => {
  it("groups every topic command under its topic", () => {
    expect(menu.topics.map((topic) => topic.name).sort()).toEqual([
      "app",
      "auth",
      "channel",
      "config",
      "deploy",
      "org",
      "version",
    ]);

    const deploy = menu.topics.find((topic) => topic.name === "deploy");
    expect(deploy?.commands.map((command) => command.label)).toEqual(["native", "ota"]);
  });

  it("shows a topic command by its last segment, not its full id", () => {
    const deploy = menu.topics.find((topic) => topic.name === "deploy");
    expect(deploy?.commands[0]).toMatchObject({ id: "deploy:native", label: "native" });
  });

  it("keeps topicless commands separate", () => {
    expect(menu.commands.map((command) => command.label)).toEqual(["setup", "init", "doctor"]);
  });

  /**
   * `help` duplicates the menu, and the empty id *is* the menu - offering "run
   * the menu" from inside it goes nowhere.
   */
  it.each(["", "help"])("never offers %s", (id) => {
    const ids = [...menu.commands, ...menu.topics.flatMap((t) => t.commands)].map((c) => c.id);
    expect(ids).not.toContain(id);
  });

  it("respects hidden", () => {
    const built = buildMenu({
      commands: [{ id: "secret", description: "no", hidden: true }, ...COMMANDS],
      topics: TOPICS,
    });

    expect(menuSize(built)).toBe(menuSize(menu));
  });

  /**
   * Alphabetical alone opens with `app` and buries `setup`, which is the command
   * a new app needs first. The menu leads with the order of a first session.
   */
  it("opens with what a new app needs, not with the alphabet", () => {
    expect(menu.commands[0]?.label).toBe("setup");
    expect(menu.topics[0]?.name).toBe("deploy");
  });

  it("falls back to the topic name when package.json describes no topic", () => {
    const built = buildMenu({ commands: COMMANDS, topics: [] });
    const deploy = built.topics.find((topic) => topic.name === "deploy");

    expect(deploy?.description).toBe("deploy");
  });

  // The count in the header has to match what is reachable, or it is a lie
  // about how much CLI there is.
  it("counts every runnable command exactly once", () => {
    expect(menuSize(menu)).toBe(COMMANDS.length - 2);
  });

  it("survives a registry with nothing in it", () => {
    const empty = buildMenu({ commands: [], topics: [] });
    expect(empty).toEqual({ topics: [], commands: [] });
    expect(menuSize(empty)).toBe(0);
  });
});

/**
 * The menu invokes commands with no argv, so a command with required positional
 * args failed the instant it was picked: `app grant` answered "Missing 2 required
 * args" from a menu whose whole purpose is not having to know the arguments.
 */
describe("requiredArgsOf", () => {
  it("finds the required args, in declaration order", () => {
    const args = requiredArgsOf({
      id: "app:grant",
      args: {
        email: { required: true, description: "Account to grant" },
        role: {
          required: true,
          description: "One of admin, developer",
          options: ["admin", "developer"],
        },
      },
    });

    // Positional, so order is the command line.
    expect(args.map((a) => a.name)).toEqual(["email", "role"]);
    expect(args[0]!.description).toBe("Account to grant");
    expect(args[1]!.options).toEqual(["admin", "developer"]);
  });

  it("ignores optional args", () => {
    const args = requiredArgsOf({
      id: "app:identifiers",
      args: {
        action: { required: false, description: "list, add or remove" },
        bundleId: { description: "Bundle identifier" },
      },
    });

    expect(args).toEqual([]);
  });

  it("is empty for a command that declares none", () => {
    expect(requiredArgsOf({ id: "doctor" })).toEqual([]);
    expect(requiredArgsOf({ id: "doctor", args: {} })).toEqual([]);
  });

  it("omits options rather than emitting an empty list", () => {
    // An empty array would make the menu render a picker with nothing in it.
    const [arg] = requiredArgsOf({ id: "x", args: { a: { required: true } } });

    expect(arg).toEqual({ name: "a", description: "" });
  });

  it("copies the option list, so the menu cannot mutate oclif's", () => {
    const options = ["admin", "developer"];
    const [arg] = requiredArgsOf({ id: "x", args: { role: { required: true, options } } });

    arg!.options!.push("owner");
    expect(options).toEqual(["admin", "developer"]);
  });
});

describe("buildMenu carries the args through", () => {
  it("puts them on the entry the menu will run", () => {
    const menu = buildMenu({
      commands: [
        {
          id: "app:grant",
          description: "Grant a role",
          args: { email: { required: true, description: "Account to grant" } },
        },
      ],
      topics: [{ name: "app", description: "Apps" }],
    });

    const grant = menu.topics[0]!.commands[0]!;
    expect(grant.requiredArgs.map((a) => a.name)).toEqual(["email"]);
  });

  it("gives a command with no args an empty list, never undefined", () => {
    const menu = buildMenu({ commands: [{ id: "doctor" }], topics: [] });

    expect(menu.commands[0]!.requiredArgs).toEqual([]);
  });
});
