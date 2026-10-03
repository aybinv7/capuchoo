/**
 * A pipeline started from outside the repository - the dashboard, or anything holding an API key.
 * The request is validated here once, and translated into the inputs the generated GitHub workflow
 * declares and the variables the generated GitLab pipeline reads, so the two never drift.
 */

export const CI_RUN_ACTIONS = ["ota", "native", "deliver", "check"] as const;
export type CiRunAction = (typeof CI_RUN_ACTIONS)[number];

export const CI_BUILD_TYPES = ["release", "debug"] as const;
export type CiBuildType = (typeof CI_BUILD_TYPES)[number];

export interface CiRunRequest {
  action: CiRunAction;
  /** Branch or tag to run on. */
  ref: string;
  /** Empty means the workflow derives it from the ref, exactly as on a push. */
  channel: string | null;
  /** `auto`, an exact version, or empty for the ref's default. */
  version: string | null;
  /** `deliver` only: the client whose `prod-<client>` channel is pointed. */
  client: string | null;
  notes: string | null;
  buildType: CiBuildType;
}

/** The `workflow_dispatch` inputs of the generated GitHub workflow, by request field. */
export const GITHUB_WORKFLOW_INPUTS = {
  action: "action",
  channel: "channel",
  version: "version",
  client: "client",
  notes: "notes",
  buildType: "build_type",
} as const;

/** The pipeline variables the generated GitLab pipeline reads when started through the API. */
export const GITLAB_PIPELINE_VARIABLES = {
  action: "CAPUCHOO_ACTION",
  channel: "CAPUCHOO_CHANNEL",
  version: "CAPUCHOO_VERSION",
  client: "CAPUCHOO_CLIENT",
  notes: "CAPUCHOO_NOTES",
  buildType: "CAPUCHOO_BUILD_TYPE",
} as const;

const CHANNEL = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERSION = /^(auto|v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const REF = /^(?!.*\.\.)(?!\/)(?!.*\/$)(?!.*@\{)[A-Za-z0-9._/-]{1,200}$/;

export type CiRunRequestResult =
  | { ok: true; request: CiRunRequest }
  | { ok: false; field: keyof CiRunRequest; message: string };

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Validates an untrusted run request. Every value reaches a workflow, so each is constrained. */
export function parseCiRunRequest(input: Record<string, unknown>): CiRunRequestResult {
  const action = input.action ?? "ota";
  if (!(CI_RUN_ACTIONS as readonly unknown[]).includes(action)) {
    return { ok: false, field: "action", message: "action must be ota, native, deliver or check" };
  }
  const ref = text(input.ref);
  if (!ref || !REF.test(ref)) {
    return { ok: false, field: "ref", message: "ref must be a branch or tag name" };
  }
  const channel = text(input.channel);
  if (channel && !CHANNEL.test(channel)) {
    return { ok: false, field: "channel", message: "channel is not a channel name" };
  }
  const version = text(input.version);
  if (version && !VERSION.test(version)) {
    return { ok: false, field: "version", message: "version must be auto or x.y.z" };
  }
  const rawClient = text(input.client)?.toLowerCase() ?? null;
  const client = rawClient?.startsWith("prod-") ? rawClient.slice(5) : rawClient;
  if (action === "deliver") {
    if (!client || !CHANNEL.test(client)) {
      return { ok: false, field: "client", message: "deliver needs a client name" };
    }
    if (!version || version === "auto") {
      return {
        ok: false,
        field: "version",
        message: "deliver needs the exact version prod serves",
      };
    }
  }
  const buildType = input.build_type ?? input.buildType ?? "release";
  if (!(CI_BUILD_TYPES as readonly unknown[]).includes(buildType)) {
    return { ok: false, field: "buildType", message: "build_type must be release or debug" };
  }
  const notes = text(input.notes)?.slice(0, 500) ?? null;
  return {
    ok: true,
    request: {
      action: action as CiRunAction,
      ref,
      channel,
      version,
      client: action === "deliver" ? client : null,
      notes,
      buildType: buildType as CiBuildType,
    },
  };
}

function inputs(
  request: CiRunRequest,
  names: Record<keyof Omit<CiRunRequest, "ref">, string>,
): Record<string, string> {
  const out: Record<string, string> = { [names.action]: request.action };
  if (request.channel) out[names.channel] = request.channel;
  if (request.version) out[names.version] = request.version;
  if (request.client) out[names.client] = request.client;
  if (request.notes) out[names.notes] = request.notes;
  if (request.action === "native") out[names.buildType] = request.buildType;
  return out;
}

export const githubDispatchInputs = (request: CiRunRequest): Record<string, string> =>
  inputs(request, GITHUB_WORKFLOW_INPUTS);

/**
 * GitLab expands `$NAME` inside the value of a variable passed to a pipeline, so notes mentioning
 * `$CAPUCHOO_API_KEY` would publish the key. `$$` is GitLab's literal dollar.
 */
export const gitlabPipelineVariables = (request: CiRunRequest): Record<string, string> =>
  Object.fromEntries(
    Object.entries(inputs(request, GITLAB_PIPELINE_VARIABLES)).map(([key, value]) => [
      key,
      value.split("$").join("$$"),
    ]),
  );

/** A short human title for a run that was started by hand. */
export function describeCiRun(request: CiRunRequest): string {
  const target =
    request.action === "deliver" ? `prod-${request.client}` : (request.channel ?? request.ref);
  const verb = {
    ota: "Publish OTA",
    native: "Build native",
    deliver: "Deliver",
    check: "Rehearse",
  }[request.action];
  return `${verb} to ${target}${request.version ? ` @ ${request.version}` : ""}`.slice(0, 200);
}
