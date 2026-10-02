import {
  describeCiRun,
  parseCiRunRequest,
  type CiBuildType,
  type CiRunAction,
  type CiRunRequest,
} from "@capuchoo/core";

export type VersionMode = "ref" | "auto" | "exact";

/** What the run dialog edits. Empty strings mean "not chosen"; the request is derived from it. */
export interface RunForm {
  action: CiRunAction;
  ref: string;
  /** Empty: the workflow derives the channel from the ref, as on a push. */
  channel: string;
  versionMode: VersionMode;
  version: string;
  /** A client channel name (`prod-acme`) or a bare client name. */
  client: string;
  notes: string;
  buildType: CiBuildType;
}

export type RunFormField = keyof RunForm;

export interface RunPreset {
  action?: CiRunAction;
  channel?: string | null;
  client?: string | null;
  ref?: string | null;
}

/** What the form knows about the repository and the app, for the rules the workflow applies. */
export interface RunContext {
  defaultBranch: string;
  tags: readonly string[];
  channels: ReadonlyArray<{ name: string; environment: string; kind: string }>;
}

export type RunValidation =
  | { ok: true; request: CiRunRequest }
  | { ok: false; field: RunFormField; message: string };

const VERSION_TAG = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** A form with the preset applied; deliver always pins an exact version. */
export function createRunForm(preset: RunPreset = {}, defaultRef = ""): RunForm {
  const action = preset.action ?? (preset.client ? "deliver" : "ota");
  return {
    action,
    ref: preset.ref ?? defaultRef,
    channel: preset.channel ?? "",
    versionMode: action === "deliver" ? "exact" : "ref",
    version: "",
    client: preset.client ?? "",
    notes: "",
    buildType: "release",
  };
}

/** The version a ref names, when it is a tag shaped like one (`v1.4.2`, `2.0.0-rc.1`). */
export function versionFromRef(ref: string, tags: readonly string[]): string | null {
  const value = ref.trim();
  return tags.includes(value) && VERSION_TAG.test(value) ? value : null;
}

/**
 * The channel the workflow would derive from a ref, when the app has it: a tag publishes to prod,
 * the default branch to prod, `staging` and `dev` to their namesakes. The dialog sends it
 * explicitly, because the server authorizes a run without a channel as a prod run.
 */
export function channelForRef(ref: string, context: RunContext): string | null {
  const value = ref.trim();
  if (!value) return null;
  let name: string | null = null;
  if (context.tags.includes(value) || value === context.defaultBranch) name = "prod";
  else if (value === "staging" || value === "dev") name = value;
  return name && context.channels.some((channel) => channel.name === name) ? name : null;
}

const isProdChannel = (name: string, context: RunContext) =>
  name === "prod" ||
  context.channels.some((channel) => channel.name === name && channel.environment === "prod");

/** The untrusted input `parseCiRunRequest` expects, exactly as the server receives it. */
export function toRunInput(form: RunForm): Record<string, unknown> {
  const deliver = form.action === "deliver";
  let version: string | null = form.version.trim() || null;
  if (!deliver && form.versionMode === "ref") version = null;
  if (!deliver && form.versionMode === "auto") version = "auto";
  return {
    action: form.action,
    ref: form.ref,
    channel: deliver ? null : form.channel.trim() || null,
    version,
    client: deliver ? form.client.trim() || null : null,
    notes: form.notes,
    build_type: form.buildType,
  };
}

const FIELD: Record<keyof CiRunRequest, RunFormField> = {
  action: "action",
  ref: "ref",
  channel: "channel",
  version: "version",
  client: "client",
  notes: "notes",
  buildType: "buildType",
};

const MESSAGES: Partial<Record<RunFormField, string>> = {
  ref: "Pick a branch or tag.",
  channel: "That is not a channel name.",
  client: "Pick the client to deliver to.",
  buildType: "Pick release or debug.",
};

function versionMessage(form: RunForm): string {
  if (form.action === "deliver" && form.version.trim().toLowerCase() === "auto")
    return "Deliver needs the exact version prod serves, not auto.";
  return "Use a version such as 1.4.2 or v2.0.0-rc.1.";
}

/**
 * Validates with the same rule the server applies, so a refusal is shown on its field before
 * anything is sent. Messages are rewritten for a person; the rule is core's.
 */
export function validateRunForm(form: RunForm, context?: RunContext): RunValidation {
  const needsExact = form.action === "deliver" || form.versionMode === "exact";
  if (needsExact && !form.version.trim()) {
    return {
      ok: false,
      field: "version",
      message:
        form.action === "deliver"
          ? "Deliver needs the exact version prod serves."
          : "Enter a version such as 1.4.2, or pick another option.",
    };
  }
  const result = parseCiRunRequest(toRunInput(form));
  if (result.ok) return context ? checkProdVersion(result.request, context) : result;
  const field = FIELD[result.field];
  const message = field === "version" ? versionMessage(form) : (MESSAGES[field] ?? result.message);
  return { ok: false, field, message };
}

/** The workflow refuses to publish prod with `auto`; say so before a runner is spent on it. */
function checkProdVersion(request: CiRunRequest, context: RunContext): RunValidation {
  if (request.action !== "ota" && request.action !== "native") return { ok: true, request };
  const channel = request.channel ?? channelForRef(request.ref, context);
  if (!channel || !isProdChannel(channel, context)) return { ok: true, request };
  const version = request.version ?? (context.tags.includes(request.ref) ? request.ref : "auto");
  if (version !== "auto") return { ok: true, request };
  return {
    ok: false,
    field: "version",
    message: "Prod is published from a tag or an exact version, never auto.",
  };
}

/** The run's title as the server will write it, for the dialog's summary line. */
export function describeRunForm(form: RunForm, context?: RunContext): string | null {
  const result = validateRunForm(form, context);
  return result.ok ? describeCiRun(result.request) : null;
}
