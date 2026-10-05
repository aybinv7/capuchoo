import { describe, expect, test } from "vite-plus/test";
import { can } from "../src/shared/access/capabilities.js";
import {
  followedChannel,
  phoneStatus,
  type StatusChannel,
} from "../src/shared/release/phone-status.js";
import { diffActivity, type Snapshot } from "../src/shared/sync/activity-diff.js";
import { normaliseEndpoint } from "../src/modules/auth/lib/endpoint.js";

const channel = (over: Partial<StatusChannel> & { id: string }): StatusChannel => ({
  name: over.id,
  environment: "prod",
  kind: "release",
  paused: 0,
  current_native_id: null,
  ...over,
});

const NATIVES = [
  { id: "n1", version_name: "1.0.0", version_code: 1 },
  { id: "n2", version_name: "1.0.1", version_code: 2 },
  { id: "n3", version_name: "1.1.0-dev.1", version_code: 3 },
];

const CHANNELS = [
  channel({ id: "prod", current_native_id: "n2" }),
  channel({ id: "dev", environment: "dev", current_native_id: "n3" }),
  channel({ id: "prod-acme", kind: "client", current_native_id: "n1" }),
];

describe("phoneStatus", () => {
  const identifiers = [
    { bundle_id: "com.example.field", flavour: null },
    { bundle_id: "com.example.field.dev", flavour: "dev" as const },
  ];

  test("a shared id follows prod, and an older install is behind it", () => {
    const status = phoneStatus({
      identifiers,
      installed: [
        { bundle_id: "com.example.field", installed: 1, version_name: "1.0.0", version_code: 1 },
      ],
      channels: CHANNELS,
      natives: NATIVES,
    });
    expect(status.state).toBe("behind");
    expect(status.channel?.id).toBe("prod");
    expect(status.target?.version_code).toBe(2);
  });

  test("a flavour's id follows its own channel, and the most urgent install is the one reported", () => {
    const status = phoneStatus({
      identifiers,
      installed: [
        { bundle_id: "com.example.field", installed: 1, version_name: "1.0.1", version_code: 2 },
        {
          bundle_id: "com.example.field.dev",
          installed: 1,
          version_name: "1.0.0",
          version_code: 1,
        },
      ],
      channels: CHANNELS,
      natives: NATIVES,
    });
    expect(status.state).toBe("behind");
    expect(status.bundleId).toBe("com.example.field.dev");
    expect(status.target?.version_code).toBe(3);
  });

  test("current, ahead, untracked and absent", () => {
    const at = (code: number) =>
      phoneStatus({
        identifiers: identifiers.slice(0, 1),
        installed: [
          { bundle_id: "com.example.field", installed: 1, version_name: "x", version_code: code },
        ],
        channels: CHANNELS,
        natives: NATIVES,
      }).state;
    expect(at(2)).toBe("current");
    expect(at(5)).toBe("ahead");
    expect(
      phoneStatus({
        identifiers: identifiers.slice(0, 1),
        installed: [
          { bundle_id: "com.example.field", installed: 1, version_name: "x", version_code: 1 },
        ],
        channels: [channel({ id: "prod" })],
        natives: NATIVES,
      }).state,
    ).toBe("untracked");
    const absent = phoneStatus({
      identifiers,
      installed: [],
      channels: CHANNELS,
      natives: NATIVES,
    });
    expect(absent.state).toBe("absent");
    expect(absent.target?.version_code).toBe(2);
  });

  test("a client channel is never the one an install follows", () => {
    expect(followedChannel([channel({ id: "prod-acme", kind: "client" })], null)).toBeNull();
  });
});

describe("diffActivity", () => {
  const before: Snapshot = {
    channels: [{ id: "c", name: "prod", environment: "prod", paused: 0, current_native_id: "n2" }],
    natives: [
      {
        id: "n1",
        version_name: "1.0.0",
        version_code: 1,
        flavour: "prod",
        created_at: "2026-10-01T10:00:00Z",
      },
      {
        id: "n2",
        version_name: "1.0.1",
        version_code: 2,
        flavour: "prod",
        created_at: "2026-10-01T11:00:00Z",
      },
    ],
  };

  test("a first sync records builds as read and no deliveries", () => {
    const rows = diffActivity("app", null, before, "2026-10-01T12:00:00Z");
    expect(rows.map((row) => row.kind)).toEqual(["build", "build"]);
    expect(rows.every((row) => row.read_at)).toBe(true);
  });

  test("a new build, a rollback and a pause, each with a stable id", () => {
    const after: Snapshot = {
      channels: [
        { id: "c", name: "prod", environment: "prod", paused: 1, current_native_id: "n1" },
      ],
      natives: [
        ...before.natives,
        {
          id: "n3",
          version_name: "1.0.2",
          version_code: 3,
          flavour: "prod",
          created_at: "2026-10-01T12:00:00Z",
        },
      ],
    };
    const rows = diffActivity("app", before, after, "2026-10-01T12:05:00Z");
    expect(rows.map((row) => [row.kind, row.id])).toEqual([
      ["build", "build:n3"],
      ["rolled_back", "point:c:n1"],
      ["paused", "pause:c:2026-10-01T12:05:00Z"],
    ]);
    expect(rows.find((row) => row.kind === "rolled_back")?.detail).toBe("1.0.1 (2)");
    expect(rows.every((row) => row.read_at === null)).toBe(true);
  });

  test("nothing changed, nothing recorded", () => {
    expect(diffActivity("app", before, before, "2026-10-01T12:05:00Z")).toEqual([]);
  });
});

describe("can", () => {
  test("installing is a tester's job", () => {
    expect(can.install({ role: "viewer", prod_role: "admin" })).toBe(false);
    expect(can.install({ role: "tester", prod_role: "admin" })).toBe(true);
  });

  test("delivering follows the server: developer below prod, the app's prod role on prod", () => {
    const developer = { role: "developer" as const, prod_role: "admin" as const };
    expect(can.deliver(developer, "dev")).toBe(true);
    expect(can.deliver(developer, "staging")).toBe(true);
    expect(can.deliver(developer, "prod")).toBe(false);
    expect(can.deliver({ ...developer, prod_role: "developer" }, "prod")).toBe(true);
    expect(can.deliver({ role: "tester", prod_role: "developer" }, "dev")).toBe(false);
    expect(can.deliver({ role: "admin", prod_role: "admin" }, "prod")).toBe(true);
  });
});

describe("normaliseEndpoint", () => {
  test("adds https, drops a trailing slash, refuses nonsense", () => {
    expect(normaliseEndpoint("updates.example.com/")).toBe("https://updates.example.com");
    expect(normaliseEndpoint("http://10.0.2.2:3000")).toBe("http://10.0.2.2:3000");
    expect(normaliseEndpoint("  ")).toBeNull();
  });
});
