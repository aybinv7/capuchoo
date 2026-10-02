/**
 * `endgroup` is not in the documented contract: the server drops `##[endgroup]` today. It is
 * accepted so that, once the server keeps the marker, groups close where the log says they do.
 */
export type LogLineKind =
  | "plain"
  | "command"
  | "group"
  | "endgroup"
  | "error"
  | "warning"
  | "notice"
  | "debug";

export interface LogLine {
  time: string | null;
  text: string;
  kind: LogLineKind;
}

/** A provider log section; `number` is the job step it belongs to, when the provider says. */
export interface LogStep {
  number: number | null;
  name: string;
  lines: LogLine[];
}

export type LogSource = "github" | "gitlab" | "archive";

export type LogsUnavailableReason =
  | "running"
  | "expired"
  | "not_linked"
  | "not_found"
  | "unsupported";

export interface AvailableJobLogs {
  available: true;
  source: LogSource;
  truncated: boolean;
  steps: LogStep[];
}

export interface UnavailableJobLogs {
  available: false;
  reason: LogsUnavailableReason;
  html_url: string | null;
}

/** `GET /api/builds/:buildId/jobs/:jobId/logs`. */
export type JobLogs = AvailableJobLogs | UnavailableJobLogs;
