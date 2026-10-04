import { randomUUID } from "node:crypto";
import { compareVersions, type RecorderHealth } from "@capuchoo/core";
import { DAY, MINUTE } from "./dice";
import { ago, after, type DemoContext } from "./context";
import type { DeviceKind } from "./fleet";
import type { SeededApp } from "./releases";
import { contentDuration, type ContentKind } from "./session-content";

/** Recording keeps 14 days; the demo stays inside them. */
const DAYS = 13;

type Start = "policy" | "error" | "shake" | "manual" | "app";

interface IssueSpec {
  message: string;
  frame: string;
  /** Relative weight among the errors an error session hits. */
  weight: number;
  status: "open" | "resolved" | "regressed";
}

interface Story {
  sessionsPerDay: [number, number];
  issues: IssueSpec[];
  notes: string[];
}

const STORIES: Record<DeviceKind, Story> = {
  tablet: {
    sessionsPerDay: [9, 16],
    issues: [
      {
        message: "TypeError: Cannot read properties of undefined (reading 'lines')",
        frame: "OrderSheet.vue:142 · computeTotals",
        weight: 6,
        status: "regressed",
      },
      {
        message: "SQLITE_BUSY: database is locked",
        frame: "syncQueue.ts:88 · flushPending",
        weight: 4,
        status: "open",
      },
      {
        message: "NetworkError: POST /api/orders answered 502",
        frame: "orders.api.ts:31 · submitOrder",
        weight: 3,
        status: "open",
      },
      {
        message: "RangeError: Invalid time value",
        frame: "DeliveryDatePicker.vue:57 · toIso",
        weight: 2,
        status: "open",
      },
      {
        message: "QuotaExceededError: the quota has been exceeded",
        frame: "catalogCache.ts:19 · storeImages",
        weight: 1,
        status: "resolved",
      },
    ],
    notes: [
      "Order total shows 0 after adding a discount line",
      "Catalog images missing for the new range",
      "Stuck on Sending after the warehouse wifi dropped",
      "Customer signature pad does not clear",
      "Could not pick a delivery date next month",
    ],
  },
  phone: {
    sessionsPerDay: [7, 13],
    issues: [
      {
        message: "Error: Proof of delivery photo exceeds 8 MB",
        frame: "ProofCapture.vue:96 · attachPhoto",
        weight: 5,
        status: "open",
      },
      {
        message: "TypeError: route.stops is not iterable",
        frame: "RouteMap.vue:211 · drawStops",
        weight: 4,
        status: "regressed",
      },
      {
        message: "GeolocationPositionError: Timeout expired",
        frame: "tracking.ts:44 · currentPosition",
        weight: 3,
        status: "open",
      },
      {
        message: "NetworkError: GET /api/routes/today answered 504",
        frame: "routes.api.ts:12 · todaysRoute",
        weight: 2,
        status: "resolved",
      },
    ],
    notes: [
      "Map froze when I reordered two stops",
      "Photo would not upload at the depot",
      "Scanned parcel shows the wrong address",
      "App asked me to log in again mid route",
    ],
  },
};

const STARTS: Array<[Start, number]> = [
  ["policy", 44],
  ["error", 18],
  ["app", 14],
  ["shake", 10],
  ["manual", 6],
];

const MODE: Record<Start, string> = {
  policy: "session",
  error: "buffer",
  shake: "buffer",
  manual: "session",
  app: "session",
};

interface DemoDevice {
  id: string;
  device_id: string;
  version_name: string | null;
  reported_channel: string | null;
  model: string | null;
  manufacturer: string | null;
  version_os: string | null;
  last_seen_at: Date | null;
}

interface IssueTally {
  id: string;
  spec: IssueSpec;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  firstVersion: string;
  lastVersion: string;
}

function weighted<T>(context: DemoContext, items: Array<[T, number]>): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = context.dice.next() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1]![0];
}

const healthOf = (
  uploaded: number,
  trouble: boolean,
  mode: RecorderHealth["mode"],
): RecorderHealth => ({
  recorder: "0.1.0",
  mode,
  threaded: true,
  storage: "opfs",
  databases: [{ name: "app", state: "changesets", detail: null }],
  queued: trouble ? 9 : 0,
  uploadedSegments: uploaded,
  droppedSegments: trouble ? 3 : 0,
  lastError: trouble ? "QuotaExceededError: OPFS quota reached; oldest segments shed" : null,
});

/** A session whose screen, console and network are written once the seed has committed. */
export interface ContentPlan {
  sessionId: string;
  appId: string;
  sessionKey: string;
  kind: ContentKind;
  startedAt: Date;
  error?: { message: string; frame: string };
}

/**
 * Two weeks of session recording on an app's fleet: sessions a rule asked for, buffers an error or
 * a shake sent up with the user's note, the errors grouped into issues - one regressed by the
 * newest release, one resolved - and each recorder's last check-in.
 */
export async function seedRecordings(
  context: DemoContext,
  seeded: SeededApp,
  kind: DeviceKind,
): Promise<{ sessions: number; issues: number; plans: ContentPlan[] }> {
  const { trx, dice } = context;
  const story = STORIES[kind];
  const devices = (await trx
    .selectFrom("devices")
    .select([
      "id",
      "device_id",
      "version_name",
      "reported_channel",
      "model",
      "manufacturer",
      "version_os",
      "last_seen_at",
    ])
    .where("app_id", "=", seeded.id)
    .where("is_prod", "=", true)
    .execute()) as DemoDevice[];
  if (devices.length === 0) return { sessions: 0, issues: 0, plans: [] };

  const issues: IssueTally[] = story.issues.map((spec) => ({
    id: randomUUID(),
    spec,
    occurrences: 0,
    firstSeen: context.now,
    lastSeen: new Date(0),
    firstVersion: "",
    lastVersion: "",
  }));
  const sessions = [];
  const links = [];
  const plans: ContentPlan[] = [];

  for (let day = DAYS - 1; day >= 0; day -= 1) {
    const count = dice.between(...story.sessionsPerDay);
    for (let index = 0; index < count; index += 1) {
      const device = dice.pick(devices);
      const start = weighted<Start>(context, STARTS);
      const startedAt = ago(context, day * DAY + dice.between(5, 22 * 60) * MINUTE);
      if (startedAt.getTime() > context.now.getTime() - 3 * MINUTE) continue;
      const errors =
        start === "error" ? dice.between(1, 4) : start === "policy" && dice.chance(0.12) ? 1 : 0;
      const content: ContentKind = errors > 0 ? "crash" : "clean";
      const lengthMs = contentDuration(content);
      const endedAt = after(startedAt, lengthMs);
      const version = device.version_name ?? "1.0.0";
      const id = randomUUID();
      const sessionKey = randomUUID();
      sessions.push({
        id,
        app_id: seeded.id,
        session_key: sessionKey,
        device_uuid: device.id,
        device_id: device.device_id,
        platform: "android",
        version_name: version,
        version_code: null,
        channel: device.reported_channel,
        start,
        mode: MODE[start],
        note: start === "shake" || start === "manual" ? dice.pick(story.notes) : null,
        device: JSON.stringify({
          model: device.model,
          manufacturer: device.manufacturer,
          osVersion: device.version_os,
        }),
        recorder: "0.1.0",
        started_at: startedAt,
        ended_at: endedAt,
        last_segment_at: endedAt,
        segment_count: 1,
        error_count: errors,
        finished: true,
      });

      const hit = new Set<IssueTally>();
      for (let error = 0; error < errors; error += 1) {
        hit.add(
          weighted(
            context,
            issues.map((issue) => [issue, issue.spec.weight] as [IssueTally, number]),
          ),
        );
      }
      const first = [...hit][0];
      plans.push({
        sessionId: id,
        appId: seeded.id,
        sessionKey,
        kind: content,
        startedAt,
        ...(first ? { error: { message: first.spec.message, frame: first.spec.frame } } : {}),
      });
      for (const issue of hit) {
        const firstAt = after(startedAt, dice.between(5, Math.max(6, lengthMs / 1000 - 5)) * 1000);
        const occurrences = dice.between(1, 3);
        issue.occurrences += occurrences;
        if (firstAt < issue.firstSeen) issue.firstSeen = firstAt;
        if (firstAt > issue.lastSeen) issue.lastSeen = firstAt;
        if (!issue.firstVersion || compareVersions(version, issue.firstVersion) < 0) {
          issue.firstVersion = version;
        }
        if (!issue.lastVersion || compareVersions(version, issue.lastVersion) > 0) {
          issue.lastVersion = version;
        }
        links.push({
          issue_id: issue.id,
          session_id: id,
          device_id: device.device_id,
          version_name: version,
          first_at: firstAt,
          occurrences,
        });
      }
    }
  }

  for (let start = 0; start < sessions.length; start += 500) {
    await trx
      .insertInto("recording_sessions")
      .values(sessions.slice(start, start + 500))
      .execute();
  }
  const seen = issues.filter((issue) => issue.occurrences > 0);
  if (seen.length > 0) {
    await trx
      .insertInto("recording_issues")
      .values(
        seen.map((issue) => ({
          id: issue.id,
          app_id: seeded.id,
          fingerprint: `demo:${issue.spec.frame}`,
          message: issue.spec.message,
          frame: issue.spec.frame,
          status: issue.spec.status,
          occurrences: issue.occurrences,
          first_version: issue.firstVersion,
          last_version: issue.lastVersion,
          first_seen: issue.firstSeen,
          last_seen: issue.lastSeen,
          resolved_at: issue.spec.status === "resolved" ? after(issue.lastSeen, DAY / 2) : null,
        })),
      )
      .execute();
    for (let start = 0; start < links.length; start += 500) {
      await trx
        .insertInto("recording_issue_sessions")
        .values(links.slice(start, start + 500))
        .execute();
    }
  }

  const reporting = devices.filter(
    (device) =>
      device.last_seen_at && context.now.getTime() - device.last_seen_at.getTime() < 2 * DAY,
  );
  const health = reporting.map((device, index) => {
    const online = dice.chance(0.35);
    const trouble = index % 17 === 3;
    return {
      app_id: seeded.id,
      device_id: device.device_id,
      device_uuid: device.id,
      platform: "android",
      version_name: device.version_name ?? "1.0.0",
      channel: device.reported_channel,
      health: JSON.stringify(
        healthOf(
          dice.between(4, 240),
          trouble,
          device.reported_channel === "staging" ? "session" : "buffer",
        ),
      ),
      seen_at: online
        ? ago(context, dice.between(5, 150) * 1000)
        : ago(context, dice.between(5, 36 * 60) * MINUTE),
    };
  });
  if (health.length > 0) await trx.insertInto("recorder_health").values(health).execute();

  const staging = seeded.channels.get("staging");
  await trx
    .insertInto("recording_rules")
    .values([
      {
        app_id: seeded.id,
        scope: "app",
        policy: JSON.stringify({ mode: "buffer", triggers: ["error", "shake", "manual"] }),
        updated_by: context.people.owner,
      },
      ...(staging
        ? [
            {
              app_id: seeded.id,
              scope: "channel" as const,
              channel_id: staging.id,
              policy: JSON.stringify({ mode: "session" }),
              updated_by: context.people.karim,
            },
          ]
        : []),
    ])
    .execute();

  return { sessions: sessions.length, issues: seen.length, plans };
}
