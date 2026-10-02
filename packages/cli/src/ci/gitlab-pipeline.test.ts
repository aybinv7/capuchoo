import { GITLAB_PIPELINE_VARIABLES } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { parseClients } from "./clients.js";
import { readGitlabTemplate, renderGitlabCi } from "./gitlab-template.js";

type Vars = Record<string, string | undefined>;

interface Rule {
  if: string | null;
  channel?: string;
  when?: string;
}

interface Outcome {
  when: string;
  channel: string | null;
}

const JOBS = ["check", "publish:ota", "publish:native", ".deliver", "deliver:api"] as const;

const PROJECT: Vars = {
  CAPUCHOO_DEV_BRANCH: "dev",
  CAPUCHOO_STAGING_BRANCH: "staging",
  CI_DEFAULT_BRANCH: "main",
};

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function parseItems(lines: string[], start: number, indent: number, yaml: string): Rule[] {
  const rules: Rule[] = [];
  const bullet = `${" ".repeat(indent)}- `;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim()) break;
    if (indentOf(line) < indent) break;
    if (line.startsWith(bullet)) {
      const body = line.slice(bullet.length);
      if (body.startsWith("*")) {
        rules.push(...anchorRules(yaml, body.slice(1)));
        continue;
      }
      rules.push({ if: body.startsWith("if: ") ? body.slice(4) : null });
      if (body.startsWith("when: ")) rules.at(-1)!.when = body.slice(6);
      continue;
    }
    const rule = rules.at(-1)!;
    const field = line.trim();
    const channel = /CAPUCHOO_CHANNEL: "([^"]+)"/.exec(field);
    if (channel) rule.channel = channel[1]!;
    if (field.startsWith("when: ")) rule.when = field.slice(6);
  }
  return rules;
}

function anchorRules(yaml: string, anchor: string): Rule[] {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.endsWith(`&${anchor}`));
  if (start < 0) throw new Error(`No anchor ${anchor}`);
  return parseItems(lines, start + 1, 2, yaml);
}

function jobRules(yaml: string, job: string): Rule[] {
  const lines = yaml.split("\n");
  const start = lines.indexOf(`${job}:`);
  if (start < 0) throw new Error(`No job ${job}`);
  for (let index = start + 1; index < lines.length && !/^\S/.test(lines[index]!); index += 1) {
    const line = lines[index]!;
    if (line === "  rules:") return parseItems(lines, index + 1, 4, yaml);
    if (line.startsWith("  rules: *")) return anchorRules(yaml, line.slice(10));
  }
  throw new Error(`${job} has no rules`);
}

function holds(expression: string, vars: Vars): boolean {
  return expression.split("&&").every((raw) => {
    const term = raw.trim();
    if (/^\$\w+$/.test(term)) return Boolean(vars[term.slice(1)]);
    const match = /^\$(\w+) (==|!=) (?:\$(\w+)|"([^"]*)")$/.exec(term);
    if (!match) throw new Error(`Unsupported rule term: ${term}`);
    const left = vars[match[1]!] ?? null;
    const right = match[3] ? (vars[match[3]] ?? null) : match[4]!;
    return match[2] === "==" ? left === right : left !== right;
  });
}

/** What GitLab does with `job` for a pipeline: its first matching rule, pipeline variables first. */
function simulate(yaml: string, job: string, pipeline: Vars): Outcome | null {
  const vars = { ...PROJECT, ...pipeline };
  const rule = jobRules(yaml, job).find((candidate) => !candidate.if || holds(candidate.if, vars));
  if (!rule || rule.when === "never") return null;
  return {
    when: rule.when ?? "on_success",
    channel: pipeline.CAPUCHOO_CHANNEL ?? rule.channel ?? null,
  };
}

function pipeline(yaml: string, vars: Vars): Record<string, Outcome | null> {
  return Object.fromEntries(JOBS.map((job) => [job, simulate(yaml, job, vars)]));
}

const run = (when: string, channel: string | null): Outcome => ({ when, channel });
const none = {
  check: null,
  "publish:ota": null,
  "publish:native": null,
  ".deliver": null,
  "deliver:api": null,
};

const push = (branch: string): Vars => ({
  CI_PIPELINE_SOURCE: "push",
  CI_COMMIT_BRANCH: branch,
  CI_COMMIT_REF_NAME: branch,
});
const tag = (source = "push"): Vars => ({
  CI_PIPELINE_SOURCE: source,
  CI_COMMIT_TAG: "v1.2.0",
  CI_COMMIT_REF_NAME: "v1.2.0",
});
const api = (ref: Vars, variables: Vars): Vars => ({
  ...ref,
  CI_PIPELINE_SOURCE: "api",
  ...variables,
});

describe("the generated GitLab pipeline", () => {
  const yaml = renderGitlabCi(readGitlabTemplate(), {
    cliVersion: "0.16.0",
    clients: parseClients("acme,globex"),
  });

  describe("on a push, a tag or a merge request", () => {
    it.each([
      [
        "a push to dev",
        push("dev"),
        {
          ...none,
          check: run("on_success", "dev"),
          "publish:ota": run("on_success", "dev"),
          "publish:native": run("manual", "dev"),
        },
      ],
      [
        "a push to staging",
        push("staging"),
        {
          ...none,
          check: run("on_success", "staging"),
          "publish:ota": run("on_success", "staging"),
          "publish:native": run("manual", "staging"),
        },
      ],
      ["a push to the default branch", push("main"), { ...none, check: run("on_success", "prod") }],
      ["a push to any other branch", push("feature/x"), none],
      [
        "a tag",
        tag(),
        {
          ...none,
          check: run("on_success", "prod"),
          "publish:ota": run("on_success", "prod"),
          "publish:native": run("manual", "prod"),
          ".deliver": run("manual", null),
        },
      ],
      [
        "a merge request into the default branch",
        {
          CI_PIPELINE_SOURCE: "merge_request_event",
          CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main",
          CAPUCHOO_API_KEY: "key",
        },
        { ...none, check: run("on_success", "prod") },
      ],
      [
        "a merge request into staging",
        {
          CI_PIPELINE_SOURCE: "merge_request_event",
          CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "staging",
          CAPUCHOO_API_KEY: "key",
        },
        { ...none, check: run("on_success", "staging") },
      ],
      [
        "a merge request that cannot see the API key",
        { CI_PIPELINE_SOURCE: "merge_request_event", CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "dev" },
        none,
      ],
      [
        "an API pipeline without CAPUCHOO_ACTION",
        { ...push("dev"), CI_PIPELINE_SOURCE: "api" },
        {
          ...none,
          check: run("on_success", "dev"),
          "publish:ota": run("on_success", "dev"),
          "publish:native": run("manual", "dev"),
        },
      ],
    ])("%s runs exactly what it did before", (_label, vars, expected) => {
      expect(pipeline(yaml, vars)).toEqual(expected);
    });
  });

  describe("started through the API with CAPUCHOO_ACTION", () => {
    it.each([
      [
        "ota on dev checks, then publishes with no manual step",
        api(push("dev"), { CAPUCHOO_ACTION: "ota" }),
        { ...none, check: run("on_success", "dev"), "publish:ota": run("on_success", "dev") },
      ],
      [
        "ota on the default branch targets prod",
        api(push("main"), { CAPUCHOO_ACTION: "ota", CAPUCHOO_VERSION: "1.3.0" }),
        { ...none, check: run("on_success", "prod"), "publish:ota": run("on_success", "prod") },
      ],
      [
        "ota on a tag keeps the manual client deliveries",
        api(tag(), { CAPUCHOO_ACTION: "ota" }),
        {
          ...none,
          check: run("on_success", "prod"),
          "publish:ota": run("on_success", "prod"),
          ".deliver": run("manual", null),
        },
      ],
      [
        "native builds automatically",
        api(push("staging"), { CAPUCHOO_ACTION: "native", CAPUCHOO_BUILD_TYPE: "debug" }),
        {
          ...none,
          check: run("on_success", "staging"),
          "publish:native": run("on_success", "staging"),
        },
      ],
      [
        "native on a tag offers no delivery of an OTA it did not publish",
        api(tag(), { CAPUCHOO_ACTION: "native" }),
        { ...none, check: run("on_success", "prod"), "publish:native": run("on_success", "prod") },
      ],
      [
        "check only rehearses",
        api(push("dev"), { CAPUCHOO_ACTION: "check" }),
        { ...none, check: run("on_success", "dev") },
      ],
      [
        "a passed channel outranks the ref's",
        api(push("dev"), { CAPUCHOO_ACTION: "ota", CAPUCHOO_CHANNEL: "staging" }),
        {
          ...none,
          check: run("on_success", "staging"),
          "publish:ota": run("on_success", "staging"),
        },
      ],
      [
        "a passed channel works from any branch",
        api(push("feature/x"), { CAPUCHOO_ACTION: "ota", CAPUCHOO_CHANNEL: "qa" }),
        { ...none, check: run("on_success", "qa"), "publish:ota": run("on_success", "qa") },
      ],
      [
        "a branch with no channel reaches check, which refuses it",
        api(push("feature/x"), { CAPUCHOO_ACTION: "ota" }),
        { ...none, check: run("on_success", null), "publish:ota": run("on_success", null) },
      ],
      [
        "deliver runs the one job that points the client channel",
        api(push("main"), {
          CAPUCHOO_ACTION: "deliver",
          CAPUCHOO_CLIENT: "acme",
          CAPUCHOO_VERSION: "1.2.0",
        }),
        { ...none, "deliver:api": run("on_success", null) },
      ],
      [
        "deliver on a tag still runs only that job",
        api(tag(), {
          CAPUCHOO_ACTION: "deliver",
          CAPUCHOO_CLIENT: "acme",
          CAPUCHOO_VERSION: "1.2.0",
        }),
        { ...none, "deliver:api": run("on_success", null) },
      ],
    ])("%s", (_label, vars, expected) => {
      expect(pipeline(yaml, vars)).toEqual(expected);
    });

    it("reads every variable core sends", () => {
      for (const name of Object.values(GITLAB_PIPELINE_VARIABLES)) expect(yaml).toContain(name);
    });

    it("takes the version and notes from the run, falling back to the push behaviour", () => {
      const version = '-v "${CAPUCHOO_VERSION:-${CI_COMMIT_TAG:-auto}}"';
      const note =
        '--note "${CAPUCHOO_NOTES:-${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA} $CI_COMMIT_TITLE}"';
      expect(yaml.split(version)).toHaveLength(4);
      expect(yaml.split(note)).toHaveLength(3);
      expect(yaml).not.toContain('-v "${CI_COMMIT_TAG:-auto}"');
    });

    it("builds the requested type, and needs the keystore for release only", () => {
      expect(yaml).toContain('BUILD_TYPE="${CAPUCHOO_BUILD_TYPE:-release}"');
      expect(yaml).toContain('--type="$BUILD_TYPE"');
      expect(yaml).toMatch(
        /if \[ "\$BUILD_TYPE" = "release" \]; then\n\s+if \[ ! -s "\$\{ANDROID_KEYSTORE_BASE64:-\}" \]/,
      );
    });

    it("refuses an unknown action, a missing channel and prod at auto before installing", () => {
      const plan = yaml.slice(yaml.indexOf(".api-plan:"), yaml.indexOf("\n# Installs"));
      expect(plan).toContain(
        'if [ "$CI_PIPELINE_SOURCE" = "api" ] && [ -n "${CAPUCHOO_ACTION:-}" ]',
      );
      expect(plan).toContain("Unknown CAPUCHOO_ACTION");
      expect(plan).toContain("start the pipeline with CAPUCHOO_CHANNEL");
      expect(plan).toContain(
        '[ "$CAPUCHOO_ACTION" != "check" ] && [ "$CAPUCHOO_CHANNEL" = "prod" ] && [ "$VERSION" = "auto" ]',
      );
      for (const anchor of ["\n.web:", "\n.native:"]) {
        const job = yaml.slice(yaml.indexOf(anchor));
        expect(job.slice(job.indexOf("before_script:"))).toMatch(
          /^before_script:\n {4}- \*api-plan\n/,
        );
      }
    });

    it("delivers only a listed client at an exact version", () => {
      const deliver = yaml.slice(yaml.indexOf("deliver:api:"), yaml.indexOf("deliver:acme:"));
      expect(yaml).toContain('CAPUCHOO_CLIENTS: "acme globex"');
      expect(deliver).toContain("environment:\n    name: prod-$CAPUCHOO_CLIENT");
      expect(deliver).toContain('case " $CAPUCHOO_CLIENTS " in');
      expect(deliver).toContain('if [ -z "$VERSION" ] || [ "$VERSION" = "auto" ]; then');
      expect(deliver).toContain('channel point "prod-$CLIENT"');
      expect(deliver).toContain('--version "${VERSION#v}"');
    });

    it("quotes every run variable the shell sees", () => {
      const variable = /\$\{?CAPUCHOO_(?:ACTION|CHANNEL|VERSION|CLIENTS?|NOTES|BUILD_TYPE)\b/;
      const shell = yaml
        .split("\n")
        .filter((line) => !/^\s*(?:#|- if:|[\w-]+:(?:\s|$))/.test(line))
        .filter((line) => variable.test(line));
      expect(shell.length).toBeGreaterThan(10);
      for (const line of shell) {
        expect(line.replace(/"(?:[^"\\]|\\.)*"/g, '""')).not.toMatch(variable);
      }
    });
  });
});
