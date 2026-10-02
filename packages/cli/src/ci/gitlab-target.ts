import path from "node:path";
import type { CiTarget } from "./ci-target.js";
import type { ClientTarget } from "./clients.js";
import { readGitlabTemplate, renderGitlabCi } from "./gitlab-template.js";

export interface GitlabTargetInput {
  cwd: string;
  cliVersion: string;
  clients: ClientTarget[];
  devBranch: string;
  stagingBranch: string;
  /** Relative to `cwd`; `.gitlab-ci.yml` when absent. */
  output?: string | undefined;
}

/** What to set up once the pipeline is written. */
export function gitlabNextSteps(clients: ClientTarget[]): string[] {
  const lines = clients.map((target) => `deliver:${target.client} -> ${target.channel}`);
  if (clients.length > 0) {
    lines.push(
      "",
      `Each channel must exist: capuchoo channel create ${clients[0]!.channel} --client --base prod`,
    );
  }
  lines.push(
    "Set CAPUCHOO_ENDPOINT, CAPUCHOO_API_KEY and CAPUCHOO_SIGNING_KEY as protected, masked variables.",
  );
  return lines;
}

/** `.gitlab-ci.yml`, rendered from the packaged template; throws on an unusable option. */
export function resolveGitlabTarget(input: GitlabTargetInput): CiTarget {
  const contents = renderGitlabCi(readGitlabTemplate(), {
    cliVersion: input.cliVersion,
    clients: input.clients,
    devBranch: input.devBranch,
    stagingBranch: input.stagingBranch,
  });
  return {
    provider: "gitlab",
    file: path.resolve(input.cwd, input.output ?? ".gitlab-ci.yml"),
    contents,
    warnings: [],
    nextSteps: gitlabNextSteps(input.clients),
    details: { devBranch: input.devBranch, stagingBranch: input.stagingBranch },
  };
}
