import { formatOffset } from "./activity";
import type { Issue } from "./issues";
import { sessionDeviceLabel } from "./recording-columns";
import { startStyle } from "@/shared/recording/start";
import type { RecordingSession } from "../types/recordings.types";

/** The recording's link at a moment: the player reads `t` and seeks there on load. */
export function linkAt(baseUrl: string, offsetMs: number): string {
  const url = new URL(baseUrl);
  url.searchParams.set("t", String(Math.max(0, Math.round(offsetMs))));
  return url.toString();
}

/**
 * A bug report to paste into a ticket: who, which build, what the user said, what broke and when,
 * each with a link that opens the replay at that moment.
 */
export function bugReport(input: {
  session: RecordingSession;
  issues: readonly Issue[];
  origin: number;
  pageUrl: string;
}): string {
  const { session } = input;
  const lines = [
    `### ${startStyle(session.start).label} - ${sessionDeviceLabel(session)}`,
    "",
    `- **Device:** ${sessionDeviceLabel(session)} (${session.device_id})`,
    `- **Bundle:** ${session.version_name}${session.version_code ? ` / native ${session.version_code}` : ""}`,
    `- **Channel:** ${session.channel ?? "unknown"}`,
    `- **When:** ${new Date(session.started_at).toLocaleString()} · ${formatOffset(session.duration_ms)} recorded`,
  ];
  if (session.device?.osVersion || session.device?.webview) {
    lines.push(
      `- **System:** OS ${session.device?.osVersion ?? "?"} · WebView ${session.device?.webview ?? "?"}`,
    );
  }
  if (session.note) lines.push("", `> ${session.note.replace(/\n/g, "\n> ")}`);
  const shown = input.issues.slice(0, 12);
  if (shown.length > 0) {
    lines.push("", "**What went wrong**", "");
    for (const issue of shown) {
      const offset = issue.t - input.origin;
      lines.push(
        `- [${formatOffset(offset)}](${linkAt(input.pageUrl, offset)}) ${issue.label.split("\n")[0]}`,
      );
    }
    if (input.issues.length > shown.length) {
      lines.push(`- …and ${input.issues.length - shown.length} more`);
    }
  }
  lines.push("", `[Open the replay](${linkAt(input.pageUrl, 0)})`);
  return lines.join("\n");
}
