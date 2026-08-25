#!/usr/bin/env node
/**
 * Asserts the plugin contract against a *running* backend.
 *
 * The unit tests prove the decision is right. They cannot prove the deployed
 * service still speaks it: a service answers over a wire, and everything
 * between the pure function and that wire - the controller, the column names,
 * the row that is actually in the database - is outside them. That gap is where
 * this project lost the most time. A native APK in the OTA `url`, `required`
 * dropped in transit, `version_name` sent where the plugin reads `version`:
 * every one of those was a *live* response that no test suite was looking at.
 *
 * So this asks the real thing. It needs no credentials and writes nothing: it
 * discovers an app's channels from the public endpoint, posts update checks as
 * a synthetic device across every state that produces a different outcome, and
 * checks the invariants that must hold for *any* response, whatever is
 * published at the time.
 *
 * The invariants come from reading @capgo/capacitor-updater's Android source -
 * see docs/CAPGO-PLUGIN.md. Breaking one does not fail loudly; it makes every
 * background check the plugin performs end as a failed update, which is what
 * was happening in production until 2026-08-25.
 *
 * Usage:
 *   node scripts/contract-smoke.mjs <bundle-id> [--url <api>] [--channel <name>]
 *
 * Example:
 *   node scripts/contract-smoke.mjs com.efficy.app
 */

const DEFAULT_API = "https://capuchoo-back.onrender.com";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : args[at + 1];
};

const appId = args.find(
  (value) => !value.startsWith("--") && !args[args.indexOf(value) - 1]?.startsWith("--"),
);
const api = (flag("url") ?? DEFAULT_API).replace(/\/+$/, "");
const onlyChannel = flag("channel");

if (!appId) {
  console.error(
    "usage: node scripts/contract-smoke.mjs <bundle-id> [--url <api>] [--channel <name>]",
  );
  process.exit(2);
}

/**
 * Device states worth asking about. Each produces a different branch, and the
 * point is coverage of outcomes rather than of inputs - the invariants must
 * hold on all of them.
 */
const STATES = [
  { label: "never updated", version_name: "builtin", versionCode: "1" },
  { label: "mid-range", version_name: "1.0.0", versionCode: "500" },
  { label: "ahead of everything", version_name: "999.0.0", versionCode: "999999" },
];

const PLATFORMS = ["android", "ios"];

/**
 * The rules, each returning null when satisfied or a reason when broken.
 *
 * Written against the response as a whole rather than per field, because the
 * failures that mattered were all relationships between fields: a bundle *and*
 * a classification, a version under the wrong name, an APK where a zip goes.
 */
const INVARIANTS = [
  {
    name: "a bundle response carries no classification",
    check: (r) =>
      r.url && r.kind !== undefined
        ? `has both url and kind="${r.kind}"; the plugin classifies it and never downloads (line 4515)`
        : null,
  },
  {
    name: "a bundle response carries no error",
    check: (r) =>
      r.url && r.error !== undefined
        ? `has both url and error="${r.error}"; the plugin classifies it and never downloads (line 4515)`
        : null,
  },
  {
    name: "a response with no bundle is classified",
    check: (r) =>
      !r.url && r.kind === undefined
        ? "has neither url nor kind; the plugin normalises the missing kind to failed (line 4337)"
        : null,
  },
  {
    name: "kind is one the plugin understands",
    check: (r) =>
      r.kind !== undefined && !["up_to_date", "blocked"].includes(r.kind)
        ? `kind="${r.kind}" is not up_to_date or blocked, so the plugin treats it as failed`
        : null,
  },
  {
    name: "version mirrors version_name",
    check: (r) =>
      r.version_name !== undefined && r.version !== r.version_name
        ? `version_name="${r.version_name}" but version="${r.version}"; the plugin reads version (line 4551)`
        : null,
  },
  {
    name: "the OTA url is a bundle, not a binary",
    check: (r) =>
      r.url && !/\.zip(\?|$)/.test(r.url)
        ? `url is "${r.url}"; the plugin unzips whatever is there as a web bundle`
        : null,
  },
  {
    name: "a native offer is not in the OTA url",
    check: (r) =>
      r.native_update && r.url
        ? "offers native_update and a top-level url at once; the plugin would download the wrong one"
        : null,
  },
  {
    name: "a native offer carries no database internals",
    check: (r) => {
      const leaked = ["id", "app_id", "uploaded_by", "created_at", "updated_at", "active"].filter(
        (key) => r.native_update && key in r.native_update,
      );
      return leaked.length ? `native_update leaks ${leaked.join(", ")} to every device` : null;
    },
  },
];

/**
 * Proves the rules above have teeth.
 *
 * "All ok" is worth nothing if the checks are vacuous, and these are easy to
 * write vacuously - every one is a conditional that returns null on the happy
 * path. So each is run against a response the deployed backend really returned
 * on 2026-08-24, before any of this was fixed, and must catch it.
 */
function selfTest() {
  const cases = [
    {
      what: "the native offer that shipped the whole database row",
      response: {
        message: "native_update_available",
        version_name: "1.0.56",
        native_update: {
          id: "6f09a78a-7f22-4a74-99c6-38d870e60c30",
          app_id: "02f675dc-98f9-4dd1-bfa4-76f06351506c",
          active: true,
          created_at: "2026-08-24T21:56:57.431446+00:00",
          version_name: "1.0.56",
          version_code: 67,
          download_url: "https://storage.example/v67-1.0.56.apk",
          platform: "android",
        },
        config: {},
      },
      expect: [
        "a response with no bundle is classified",
        "a native offer carries no database internals",
      ],
    },
    {
      what: "the OTA response that never sent the field the plugin reads",
      response: {
        version_name: "1.0.55",
        url: "https://storage.example/bundle-android-1.0.55.zip",
        checksum: "52a6d49b",
        config: {},
      },
      expect: ["version mirrors version_name"],
    },
    {
      what: "the silent up-to-date response",
      response: { message: "No update available", config: {} },
      expect: ["a response with no bundle is classified"],
    },
    {
      what: "an APK served in the OTA url, which cost 45 MB and a day",
      response: {
        version_name: "1.0.53",
        version: "1.0.53",
        url: "https://storage.example/v64-1.0.53.apk",
        native_update: { version_name: "1.0.53", download_url: "https://storage.example/v64.apk" },
        config: {},
      },
      expect: ["the OTA url is a bundle, not a binary", "a native offer is not in the OTA url"],
    },
  ];

  const problems = [];

  for (const testCase of cases) {
    const caught = INVARIANTS.filter((rule) => rule.check(testCase.response)).map((r) => r.name);

    for (const name of testCase.expect) {
      if (!caught.includes(name)) {
        problems.push(`"${name}" did not catch ${testCase.what}`);
      }
    }

    console.log(`  ${caught.length ? "caught" : "MISSED"}  ${testCase.what}`);
  }

  if (problems.length) {
    console.error(
      `\nThe checks are not doing their job:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("\nEvery check catches the real response it was written for.\n");
}

async function post(path, body) {
  const response = await fetch(`${api}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: null, raw: text };
  }
}

async function channelsFor(bundleId) {
  const response = await fetch(
    `${api}/api/channels?appId=${encodeURIComponent(bundleId)}&platform=android`,
  );
  if (!response.ok) throw new Error(`could not list channels: ${response.status}`);

  const { channels } = await response.json();
  return channels.map((channel) => channel.name);
}

console.log(`contract smoke: ${appId} against ${api}\n`);

// Always, not behind a flag: it costs nothing and it is the difference between
// "everything passed" and "everything passed, and the checks can fail".
console.log("checking the checks against real pre-fix responses:");
selfTest();

const discovered = await channelsFor(appId);
const channels = onlyChannel ? [onlyChannel] : discovered;

if (channels.length === 0) {
  console.error(`No channels found for ${appId}. Nothing to check.`);
  process.exit(1);
}

console.log(`channels: ${channels.join(", ")}\n`);

const failures = [];
let checked = 0;

for (const channel of channels) {
  for (const platform of PLATFORMS) {
    for (const state of STATES) {
      const { status, body, raw } = await post("/api/update", {
        appId,
        platform,
        channel,
        version_name: state.version_name,
        versionCode: state.versionCode,
        // A stable synthetic id, so this never pollutes real device counts with
        // a new row per run.
        deviceId: "contract-smoke-0000-0000-0000",
      });

      const where = `${channel}/${platform}/${state.label}`;

      if (status !== 200 || !body) {
        failures.push(`${where}: HTTP ${status}${raw ? ` - ${raw.slice(0, 120)}` : ""}`);
        continue;
      }

      const outcome = body.message ?? (body.url ? "bundle offered" : "(no message)");
      const broken = INVARIANTS.map((rule) => {
        const reason = rule.check(body);
        return reason ? `${rule.name} - ${reason}` : null;
      }).filter(Boolean);

      checked += 1;

      if (broken.length === 0) {
        console.log(`  ok    ${where.padEnd(38)} ${outcome}`);
      } else {
        console.log(`  FAIL  ${where.padEnd(38)} ${outcome}`);
        for (const reason of broken) failures.push(`${where}: ${reason}`);
      }
    }
  }
}

console.log(`\n${checked} responses checked against ${INVARIANTS.length} invariants each.`);

if (failures.length) {
  console.error(`\n${failures.length} broken:\n${failures.map((f) => `  - ${f}`).join("\n")}\n`);
  process.exit(1);
}

console.log("The deployed backend honours the plugin contract.");
