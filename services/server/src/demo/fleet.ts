import { randomUUID } from "node:crypto";
import { classifyUpdateEvent, type DeviceAttributes } from "@capuchoo/core";
import { DAY, HOUR, MINUTE } from "./dice";
import { ago, type DemoContext } from "./context";
import type { SeededApp } from "./releases";

export interface FleetGroup {
  channel: string;
  count: number;
  /** Share of devices that have not taken the channel's latest version yet. */
  lag: number;
  prefix: string;
}

export type DeviceKind = "tablet" | "phone";

const MODELS: Record<DeviceKind, Array<[string, string, string]>> = {
  tablet: [
    ["samsung", "SM-X216B", "Galaxy Tab A9+"],
    ["samsung", "SM-X306B", "Galaxy Tab Active5"],
    ["LENOVO", "TB-X606F", "Lenovo Tab M10 Plus"],
    ["Xiaomi", "23073RPBFG", "Redmi Pad SE"],
    ["Zebra Technologies", "ET45", "Zebra ET45"],
  ],
  phone: [
    ["samsung", "SM-A155F", "Galaxy A15"],
    ["samsung", "SM-A256B", "Galaxy A25"],
    ["Xiaomi", "24117RN76G", "Redmi Note 14"],
    ["Honeywell", "CT45", "Honeywell CT45"],
    ["OPPO", "CPH2591", "OPPO A79"],
  ],
};

const OS_VERSIONS = ["11", "12", "13", "13", "14", "14", "15"];
const CITIES: Array<[number, number]> = [
  [36.7538, 3.0588],
  [35.6971, -0.6308],
  [36.365, 6.6147],
  [36.19, 5.41],
  [35.2, 0.63],
  [36.47, 2.83],
  [34.85, 5.73],
];
const ROUTES = ["Oran West", "Oran Centre", "Algiers East", "Bab Ezzouar", "Setif North", "Blida", "Tizi Ouzou"];
const DEPOTS = ["DEP-ALG-01", "DEP-ORN-02", "DEP-STF-03", "DEP-BLD-04"];

/** What a signed-in app would attach: opaque ids and a route, never a name or a phone number. */
function attributesFor(
  context: DemoContext,
  kind: DeviceKind,
  channel: string,
  serial: number,
): DeviceAttributes | null {
  const { dice } = context;
  if (channel === "dev" || channel === "staging") {
    return { tester: `QA-${String(dice.between(1, 6)).padStart(2, "0")}`, build: "internal" };
  }
  if (dice.chance(0.12)) return null;
  const depot = dice.pick(DEPOTS);
  return kind === "tablet"
    ? { rep: `REP-${serial}`, route: dice.pick(ROUTES), depot, territory: dice.between(1, 40) }
    : { driver: `DRV-${serial}`, vehicle: `VAN-${dice.between(10, 99)}`, depot };
}

const CRASH =
  "App crashed on start: TypeError: Cannot read properties of undefined (reading 'lines')";

interface SeededDevice {
  id: string;
  channelId: string;
  channel: string;
  version: string;
  lagging: boolean;
  lastSeenMs: number;
}

type EventRow = {
  app_id: string;
  device_uuid: string;
  channel_id: string;
  kind: "ota" | "check";
  action: string;
  status: string | null;
  version_from: string | null;
  version_to: string | null;
  error: string | null;
  created_at: Date;
};

const previousVersion = (seeded: SeededApp, channel: string, version: string): string => {
  const moves = seeded.catalog.moves.filter(
    (move) => move.channel === channel && move.to === version,
  );
  return moves.at(-1)?.from ?? version;
};

async function insertDevices(
  context: DemoContext,
  seeded: SeededApp,
  groups: FleetGroup[],
  kind: DeviceKind,
) {
  const { dice } = context;
  const devices: SeededDevice[] = [];
  let serial = 100;
  for (const group of groups) {
    const channel = seeded.channels.get(group.channel);
    const current = channel?.spec.bundle;
    if (!channel || !current) continue;
    const native = channel.spec.native ? seeded.natives.get(channel.spec.native)?.spec : undefined;
    const rows = [];
    const meta: Array<Omit<SeededDevice, "id">> = [];
    for (let index = 0; index < group.count; index += 1) {
      serial += dice.between(1, 9);
      const [manufacturer, model, label] = dice.pick(MODELS[kind]);
      const lagging = dice.chance(group.lag);
      const version = lagging ? previousVersion(seeded, group.channel, current) : current;
      const stale = dice.chance(0.06);
      const lastSeenMs = stale ? dice.between(4, 18) * DAY : dice.between(2, 44 * 60) * MINUTE;
      const [lat, lng] = dice.pick(CITIES);
      const attributes = attributesFor(context, kind, group.channel, serial);
      const located = dice.chance(0.7);
      rows.push({
        app_id: seeded.id,
        device_id: randomUUID(),
        custom_id: `${group.prefix}-${String(serial).padStart(4, "0")}`,
        attributes: attributes ? JSON.stringify(attributes) : null,
        platform: "android" as const,
        is_prod: group.channel !== "dev",
        is_emulator: false,
        version_name: version,
        version_builtin: native?.version ?? "1.0.0",
        version_code: native?.code ?? 100,
        version_os: dice.pick(OS_VERSIONS),
        plugin_version: "8.51.0",
        reported_channel: channel.spec.base ? channel.spec.base : group.channel,
        channel_id: channel.id,
        assigned_channel_id: channel.spec.base ? channel.id : null,
        device_name: label,
        manufacturer,
        model,
        mem_used_bytes: dice.between(180, 420) * 1_048_576,
        latitude: located ? lat + (dice.next() - 0.5) * 0.35 : null,
        longitude: located ? lng + (dice.next() - 0.5) * 0.35 : null,
        location_accuracy_m: located ? dice.between(8, 60) : null,
        location_reported_at: located ? ago(context, lastSeenMs) : null,
        last_seen_at: ago(context, lastSeenMs),
        attributes_updated_at: attributes
          ? ago(context, lastSeenMs + dice.between(1, 72) * HOUR)
          : null,
        created_at: ago(context, dice.between(20, 100) * DAY),
        updated_at: ago(context, lastSeenMs),
      });
      meta.push({ channelId: channel.id, channel: group.channel, version, lagging, lastSeenMs });
    }
    if (rows.length === 0) continue;
    const inserted = await context.trx.insertInto("devices").values(rows).returning("id").execute();
    inserted.forEach((row, index) => devices.push({ id: row.id, ...meta[index]! }));
  }
  return devices;
}

/** Releases that were rolled back, as the bad version and the day it went out. */
function incidents(
  seeded: SeededApp,
): Array<{ channel: string; bad: string; from: number; to: number }> {
  return seeded.catalog.moves
    .filter((move) => move.rollback && move.from)
    .map((move) => {
      const shipped = seeded.catalog.moves.find(
        (other) =>
          other.channel === move.channel && other.to === move.from && other.days > move.days,
      );
      return {
        channel: move.channel,
        bad: move.from!,
        from: shipped?.days ?? move.days + 1,
        to: move.days,
      };
    });
}

function deviceEvents(context: DemoContext, seeded: SeededApp, device: SeededDevice): EventRow[] {
  const { dice } = context;
  const events: EventRow[] = [];
  const base = { app_id: seeded.id, device_uuid: device.id, channel_id: device.channelId };
  const lastDay = Math.floor(device.lastSeenMs / DAY);
  for (let day = 27; day >= lastDay; day -= 1) {
    const checks = dice.between(2, 6);
    for (let n = 0; n < checks; n += 1) {
      const at = day * DAY + dice.between(7, 18) * HOUR + dice.between(0, 59) * MINUTE;
      if (at < device.lastSeenMs) continue;
      events.push({
        ...base,
        kind: "check",
        action: "get",
        status: "check",
        version_from: device.version,
        version_to: null,
        error: null,
        created_at: ago(context, at),
      });
    }
  }
  const rolledBack = incidents(seeded).filter((incident) => incident.channel === device.channel);
  for (const move of seeded.catalog.moves.filter(
    (entry) => entry.channel === device.channel && entry.days <= 27,
  )) {
    if (device.lagging && move.to === device.version) continue;
    if (device.lastSeenMs > move.days * DAY) continue;
    const when = Math.max(device.lastSeenMs, (move.days - dice.next() * 0.6) * DAY);
    if (dice.chance(0.035)) {
      events.push({
        ...base,
        kind: "ota",
        action: "download_fail",
        status: "failed",
        version_from: null,
        version_to: move.to,
        error: "Connection reset while downloading",
        created_at: ago(context, when + 20 * MINUTE),
      });
    }
    events.push({
      ...base,
      kind: "ota",
      action: "set",
      status: "delivered",
      version_from: move.from,
      version_to: move.to,
      error: null,
      created_at: ago(context, when),
    });
    const incident = rolledBack.find((entry) => entry.bad === move.to && entry.from === move.days);
    if (incident && dice.chance(0.32)) {
      const crashed = when - dice.between(5, 90) * MINUTE;
      events.push({
        ...base,
        kind: "ota",
        action: "update_fail",
        status: "failed",
        version_from: move.from,
        version_to: move.to,
        error: CRASH,
        created_at: ago(context, Math.max(crashed, incident.to * DAY + MINUTE)),
      });
    }
  }
  return events;
}

/** A fleet on each channel, 28 days of update checks, deliveries, and the failures of a bad release. */
export async function seedFleet(
  context: DemoContext,
  seeded: SeededApp,
  groups: FleetGroup[],
  kind: DeviceKind,
): Promise<{ devices: number; events: number }> {
  const devices = await insertDevices(context, seeded, groups, kind);
  const events = devices
    .flatMap((device) => deviceEvents(context, seeded, device))
    .map((event) => ({ ...event, category: classifyUpdateEvent(event.action) }));
  for (let start = 0; start < events.length; start += 1_000) {
    await context.trx
      .insertInto("device_events")
      .values(events.slice(start, start + 1_000))
      .execute();
  }
  return { devices: devices.length, events: events.length };
}
