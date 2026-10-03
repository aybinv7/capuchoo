import type { DatabaseHealth, RecorderHealth } from "@capuchoo/core";
import type { Tone } from "@/shared/lib/tone";

export interface HealthCheck {
  id: string;
  label: string;
  value: string;
  tone: Tone;
  /** What to change, when something should change. */
  fix: string | null;
}

const DATABASE: Record<
  DatabaseHealth["state"],
  { value: string; tone: Tone; fix: ((detail: string | null) => string) | null }
> = {
  changesets: { value: "Changesets with values", tone: "success", fix: null },
  rows: { value: "Rows with values", tone: "success", fix: null },
  changes: {
    value: "Table names only",
    tone: "warning",
    fix: () =>
      "Writes arrive without their values. Give the source an execute function, or use sqlChangesSource.",
  },
  waiting: {
    value: "Waiting for the database",
    tone: "info",
    fix: () => "The database has not opened yet; the source starts once its ready promise settles.",
  },
  off: { value: "Off", tone: "muted", fix: null },
  unsupported: {
    value: "Not supported",
    tone: "warning",
    fix: (detail) =>
      `${detail ?? "This engine cannot record changesets"}. Pass sqlChangesSource as the fallback to record rows instead.`,
  },
  unavailable: {
    value: "Never opened",
    tone: "danger",
    fix: (detail) =>
      `The app's database did not open${detail ? `: ${detail}` : ""}. The recording of that boot shows why.`,
  },
  failed: {
    value: "Failed to start",
    tone: "danger",
    fix: (detail) => detail ?? "The source threw while starting; the console lane has the error.",
  },
};

/** What a recorder said about itself, turned into verdicts a developer can act on. */
export function healthChecks(health: RecorderHealth): HealthCheck[] {
  const checks: HealthCheck[] = [
    health.threaded
      ? { id: "worker", label: "Worker", value: "Off the UI thread", tone: "success", fix: null }
      : {
          id: "worker",
          label: "Worker",
          value: "On the UI thread",
          tone: "warning",
          fix: "Pass worker: () => new RecorderWorker(); without it serialization and gzip share the thread that renders.",
        },
  ];

  if (health.storage === "opfs") {
    checks.push({
      id: "storage",
      label: "Storage",
      value: "OPFS, survives a crash",
      tone: "success",
      fix: null,
    });
  } else if (health.storage === "memory") {
    checks.push({
      id: "storage",
      label: "Storage",
      value: "Memory only",
      tone: "warning",
      fix: "OPFS sync access handles are unavailable here, so a crash loses what was not uploaded yet.",
    });
  }

  for (const database of health.databases) {
    const state = DATABASE[database.state];
    checks.push({
      id: `db:${database.name}`,
      label: `Database ${database.name}`,
      value: state.value,
      tone: state.tone,
      fix: state.fix?.(database.detail) ?? null,
    });
  }
  if (health.databases.length === 0) {
    checks.push({
      id: "db",
      label: "Database",
      value: "None registered",
      tone: "muted",
      fix: null,
    });
  }

  if (health.droppedSegments > 0) {
    checks.push({
      id: "dropped",
      label: "Dropped",
      value: `${health.droppedSegments} segment${health.droppedSegments === 1 ? "" : "s"}`,
      tone: "warning",
      fix: "The buffer filled before uploads caught up. Raise buffer.maxBytes or lower what is recorded.",
    });
  }
  if (health.lastError) {
    checks.push({
      id: "error",
      label: "Last error",
      value: health.lastError,
      tone: "danger",
      fix: null,
    });
  }
  return checks;
}

/** The worst tone among a device's checks, for its summary dot. */
export function overallTone(checks: readonly HealthCheck[]): Tone {
  const order: Tone[] = ["danger", "warning", "info", "success", "muted"];
  for (const tone of order) if (checks.some((check) => check.tone === tone)) return tone;
  return "muted";
}
