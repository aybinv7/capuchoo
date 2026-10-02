import { describe, expect, it } from "vite-plus/test";
import {
  normalizeActivityEvent,
  normalizeDeviceDetail,
  normalizeDeviceEvent,
  normalizeEventPage,
} from "./normalize";

const row = {
  id: "uuid-1",
  app_id: "app-1",
  device_id: "android-abc",
  platform: "android",
  last_seen_at: "2026-10-02T10:00:00Z",
  created_at: "2026-09-01T10:00:00Z",
};

describe("normalizeDeviceDetail", () => {
  it("reads a full detail", () => {
    const detail = normalizeDeviceDetail({
      ...row,
      attributes: { rep: "K. Haddad" },
      attributes_updated_at: "2026-10-02T09:00:00Z",
      retention_days: 90,
      channel: { id: "ch-1", name: "prod", environment: "prod" },
      assigned_channel: { id: "ch-1", name: "prod" },
      summary: {
        days: 30,
        checks: 12,
        delivered: 2,
        failed: 1,
        last_delivered: { version: "1.4.2", at: "2026-10-01T10:00:00Z" },
        last_failure: { action: "download_fail", error: "checksum", at: "2026-09-30T10:00:00Z" },
      },
    });
    expect(detail).toMatchObject({
      retention_days: 90,
      attributes: { rep: "K. Haddad" },
      channel: { id: "ch-1", name: "prod", environment: "prod" },
      assigned_channel: { id: "ch-1", name: "prod" },
      summary: { checks: 12, last_failure: { action: "download_fail", error: "checksum" } },
    });
  });

  it("is total over a server that omits attributes, channels and the summary", () => {
    const detail = normalizeDeviceDetail({
      ...row,
      channel: { name: "no id" },
      summary: { checks: "many", last_delivered: { version: "1.0.0" } },
    });
    expect(detail).toMatchObject({
      attributes: null,
      attributes_updated_at: null,
      retention_days: null,
      channel: null,
      assigned_channel: null,
      summary: { days: 30, checks: 0, last_delivered: null, last_failure: null },
    });
  });

  it("drops a body that names no device, and an unknown environment", () => {
    expect(normalizeDeviceDetail({ id: "x" })).toBeNull();
    expect(normalizeDeviceDetail(null)).toBeNull();
    expect(
      normalizeDeviceDetail({ ...row, channel: { id: "c", name: "c", environment: "qa" } })?.channel
        ?.environment,
    ).toBeNull();
  });
});

describe("events", () => {
  it("reads numeric ids and fills what a row leaves out", () => {
    expect(normalizeDeviceEvent({ id: 7, created_at: "2026-10-02T10:00:00Z" })).toEqual({
      id: "7",
      kind: "ota",
      action: "unknown",
      category: "other",
      status: null,
      version_from: null,
      version_to: null,
      version_code_to: null,
      error: null,
      channel_id: null,
      created_at: "2026-10-02T10:00:00Z",
    });
  });

  it("keeps the device of an app-wide event, null when it was removed", () => {
    const base = { id: "1", created_at: "2026-10-02T10:00:00Z", category: "failed" };
    expect(
      normalizeActivityEvent({
        ...base,
        device: { id: "d", custom_id: "C-1", attributes: { rep: "A", bad: {} } },
      })?.device,
    ).toEqual({
      id: "d",
      custom_id: "C-1",
      device_name: null,
      model: null,
      attributes: { rep: "A" },
    });
    expect(normalizeActivityEvent({ ...base, device: null })?.device).toBeNull();
  });

  it("drops unreadable rows from a page and reads a missing cursor as the end", () => {
    const page = normalizeEventPage(
      { events: [{ id: "1", created_at: "2026-10-02T10:00:00Z" }, { id: "2" }, "x"] },
      normalizeDeviceEvent,
    );
    expect(page.events.map((event) => event.id)).toEqual(["1"]);
    expect(page.next).toBeNull();
    expect(normalizeEventPage("oops", normalizeDeviceEvent)).toEqual({ events: [], next: null });
  });
});
