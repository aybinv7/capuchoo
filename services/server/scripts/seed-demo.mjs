/**
 * Seeds a realistic, entirely fictional organization ("Northwind Distribution") for demos,
 * screenshots and local development: an app on three flavours with client channels, signed
 * releases, a pointer history with a rollback, a fleet of tablets with 28 days of activity,
 * builds, audit entries and remote config.
 *
 * Idempotent: the organization is removed and recreated on every run. Refuses to run with
 * NODE_ENV=production unless ALLOW_DEMO_SEED=true.
 *
 *   DATABASE_URL=... DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/seed-demo.mjs
 */
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  scrypt,
  sign,
} from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const SLUG = "northwind-demo";
const APP_ID = "com.northwind.fieldsales";
const DAY = 86_400_000;
const HOUR = 3_600_000;

const derive = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", 16384, 8, 5, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Deterministic pseudo-random numbers, so every run produces the same fleet. */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = rng(20260930);
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const ago = (ms) => new Date(Date.now() - ms);

function checksumOf(label) {
  return createHash("sha256").update(label).digest("hex");
}

function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;
  if (!url) throw new Error("DATABASE_URL is required");
  if (!email || !password || password.length < 12)
    throw new Error("DEMO_EMAIL and DEMO_PASSWORD (12+ characters) are required");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true")
    throw new Error("Refusing to seed demo data with NODE_ENV=production");
  return seed({ url, email, password });
}

async function seed({ url, email, password }) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const q = (text, values) => client.query(text, values);
  const one = async (text, values) => (await q(text, values)).rows[0];

  try {
    await q("BEGIN");
    const existing = await one("SELECT id FROM organizations WHERE slug = $1", [SLUG]);
    if (existing) {
      await q(
        `UPDATE channels SET current_bundle_id = NULL, current_native_id = NULL
          WHERE app_id IN (SELECT id FROM apps WHERE organization_id = $1)`,
        [existing.id],
      );
      await q(
        `DELETE FROM channels WHERE kind = 'client'
          AND app_id IN (SELECT id FROM apps WHERE organization_id = $1)`,
        [existing.id],
      );
      await q("DELETE FROM organizations WHERE id = $1", [existing.id]);
    }

    const people = [
      { email, name: "Maya Laurent", role: "owner", appRole: null, password: true },
      {
        email: "karim.haddad@northwind.example",
        name: "Karim Haddad",
        role: "admin",
        appRole: null,
      },
      {
        email: "ines.duval@northwind.example",
        name: "Inès Duval",
        role: "member",
        appRole: "developer",
      },
      {
        email: "omar.saidi@northwind.example",
        name: "Omar Saïdi",
        role: "member",
        appRole: "developer",
      },
      {
        email: "lea.martin@northwind.example",
        name: "Léa Martin",
        role: "member",
        appRole: "tester",
      },
    ];
    const passwordHash = await hashPassword(password);
    const users = {};
    for (const person of people) {
      const row = await one(
        `INSERT INTO users (email, password_hash, full_name, last_login_at, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
         RETURNING id`,
        [
          person.email,
          person.password ? passwordHash : null,
          person.name,
          ago(between(1, 30) * HOUR),
          ago(120 * DAY),
        ],
      );
      users[person.email] = row.id;
    }
    const owner = users[email];
    const karim = users["karim.haddad@northwind.example"];
    const ines = users["ines.duval@northwind.example"];

    const org = await one(
      `INSERT INTO organizations (name, slug, created_at) VALUES ('Northwind Distribution', $1, $2) RETURNING id`,
      [SLUG, ago(120 * DAY)],
    );
    for (const person of people)
      await q(
        `INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4)`,
        [org.id, users[person.email], person.role, ago(110 * DAY)],
      );

    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicKeyB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const signRelease = (kind, platform, version, versionCode, sha256hex) =>
      sign(
        "sha256",
        Buffer.from(
          `capuchoo-release-v1\n${kind}\n${APP_ID}\n${platform}\n${version}\n${versionCode ?? ""}\n${sha256hex}`,
        ),
        { key: privateKey, dsaEncoding: "ieee-p1363" },
      ).toString("base64url");

    const app = await one(
      `INSERT INTO apps (organization_id, app_id, name, platform, public_key, require_signature, prod_role, created_at)
       VALUES ($1, $2, 'Northwind Field Sales', 'android', $3, true, 'admin', $4) RETURNING id`,
      [org.id, APP_ID, publicKeyB64, ago(110 * DAY)],
    );
    await q(
      `INSERT INTO app_identifiers (app_id, bundle_id, platform) VALUES ($1, $2, 'android')`,
      [app.id, APP_ID],
    );
    for (const person of people.filter((entry) => entry.appRole))
      await q(`INSERT INTO app_permissions (app_id, user_id, role) VALUES ($1, $2, $3)`, [
        app.id,
        users[person.email],
        person.appRole,
      ]);

    const natives = {};
    const nativeSpecs = [
      {
        key: "prod-170",
        version: "1.7.0",
        code: 170,
        flavour: "prod",
        days: 62,
        notes: "Barcode scanner on Zebra devices, Android 14 support.",
      },
      {
        key: "prod-190",
        version: "1.9.0",
        code: 190,
        flavour: "prod",
        days: 16,
        required: true,
        notes: "Bluetooth receipt printers and background sync. Required for 1.9 bundles.",
      },
      {
        key: "staging-190",
        version: "1.9.0",
        code: 190,
        flavour: "staging",
        days: 19,
        notes: "Release candidate of the 1.9 native layer.",
      },
    ];
    for (const spec of nativeSpecs) {
      const checksum = checksumOf(`native-${spec.key}`);
      const row = await one(
        `INSERT INTO native_builds (app_id, platform, version_name, version_code, flavour, storage_key, size_bytes,
           checksum, signature, signing_cert_sha256, required, release_notes, min_sdk, uploaded_by, created_at)
         VALUES ($1, 'android', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 26, $12, $13) RETURNING id`,
        [
          app.id,
          spec.version,
          spec.code,
          spec.flavour,
          `demo/native/${spec.key}.apk`,
          between(31, 36) * 1_048_576 + between(0, 900_000),
          checksum,
          signRelease("native", "android", spec.version, spec.code, checksum),
          checksumOf("northwind-release-certificate"),
          spec.required ?? false,
          spec.notes,
          karim,
          ago(spec.days * DAY),
        ],
      );
      natives[spec.key] = { id: row.id, ...spec };
    }

    const bundles = {};
    const bundleSpecs = [
      { v: "1.7.0", f: "prod", days: 60, notes: "Visit planner and route optimisation." },
      { v: "1.7.1", f: "prod", days: 52, notes: "Fixes totals rounding on multi-currency orders." },
      { v: "1.8.0", f: "prod", days: 41, notes: "Promotions engine and customer credit limits." },
      { v: "1.8.1", f: "prod", days: 33, notes: "Faster catalogue search on large assortments." },
      { v: "1.8.2", f: "prod", days: 24, notes: "Offline order queue retries with backoff." },
      {
        v: "1.9.0",
        f: "prod",
        days: 14,
        min: 190,
        notes: "Receipt printing and background sync. Needs native 1.9.0.",
      },
      { v: "1.9.1", f: "prod", days: 3, min: 190, notes: "Stock reservation for key accounts." },
      {
        v: "1.9.2-rc.1",
        f: "staging",
        days: 2,
        min: 190,
        notes: "Returns workflow, first candidate.",
      },
      {
        v: "1.9.2-rc.2",
        f: "staging",
        days: 1,
        min: 190,
        notes: "Returns workflow, fixes photo upload on slow networks.",
      },
      { v: "1.10.0-dev.7", f: "dev", days: 0.3, notes: "Delivery proof with signature capture." },
    ];
    for (const spec of bundleSpecs) {
      const checksum = checksumOf(`bundle-${spec.v}`);
      const row = await one(
        `INSERT INTO bundles (app_id, platform, version_name, flavour, storage_key, size_bytes, checksum, signature,
           min_native_version, required, release_notes, uploaded_by, created_at)
         VALUES ($1, 'android', $2, $3, $4, $5, $6, $7, $8, false, $9, $10, $11) RETURNING id`,
        [
          app.id,
          spec.v,
          spec.f,
          `demo/ota/${spec.v}.zip`,
          between(3, 6) * 1_048_576 + between(0, 900_000),
          checksum,
          signRelease("ota", "android", spec.v, null, checksum),
          spec.min ?? null,
          spec.notes,
          spec.f === "prod" ? karim : ines,
          ago(spec.days * DAY),
        ],
      );
      bundles[spec.v] = { id: row.id, ...spec };
    }

    const channelSpecs = [
      { name: "dev", env: "dev", bundle: "1.10.0-dev.7", native: null, selfSet: true },
      { name: "staging", env: "staging", bundle: "1.9.2-rc.2", native: "staging-190" },
      { name: "prod", env: "prod", bundle: "1.9.1", native: "prod-190" },
      { name: "prod-contoso", env: "prod", bundle: "1.9.1", native: "prod-190", base: "prod" },
      { name: "prod-fabrikam", env: "prod", bundle: "1.9.0", native: "prod-190", base: "prod" },
      { name: "prod-tailspin", env: "prod", bundle: "1.8.2", native: "prod-170", base: "prod" },
    ];
    const channels = {};
    for (const spec of channelSpecs) {
      const row = await one(
        `INSERT INTO channels (app_id, name, environment, kind, base_channel_id, allow_device_self_set, is_public,
           current_bundle_id, current_native_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING id`,
        [
          app.id,
          spec.name,
          spec.env,
          spec.base ? "client" : "release",
          spec.base ? channels[spec.base].id : null,
          spec.selfSet ?? false,
          spec.name === "prod",
          bundles[spec.bundle].id,
          spec.native ? natives[spec.native].id : null,
          ago(100 * DAY),
        ],
      );
      channels[spec.name] = { id: row.id, ...spec };
    }

    const history = [
      ["prod", "1.7.1", "1.8.0", 40, karim, null],
      ["prod-contoso", "1.7.1", "1.8.0", 39, karim, null],
      ["prod-fabrikam", "1.7.1", "1.8.0", 37, karim, null],
      ["prod", "1.8.0", "1.8.1", 32, karim, null],
      ["prod-tailspin", "1.8.0", "1.8.1", 30, karim, null],
      ["prod", "1.8.1", "1.8.2", 23, karim, null],
      [
        "prod",
        "1.8.2",
        "1.8.1",
        22.6,
        owner,
        "Order sync stalls on Android 11 tablets after resume",
      ],
      ["prod", "1.8.1", "1.8.2", 21, karim, null],
      ["prod-tailspin", "1.8.1", "1.8.2", 20, karim, null],
      ["prod-contoso", "1.8.0", "1.8.2", 19, karim, null],
      ["prod", "1.8.2", "1.9.0", 13, owner, null],
      ["prod-contoso", "1.8.2", "1.9.0", 12, karim, null],
      ["prod-fabrikam", "1.8.0", "1.9.0", 6, karim, null],
      ["prod", "1.9.0", "1.9.1", 2.8, karim, null],
      ["prod-contoso", "1.9.0", "1.9.1", 1.9, karim, null],
      ["staging", "1.9.2-rc.1", "1.9.2-rc.2", 0.9, ines, null],
      ["dev", "1.10.0-dev.6", "1.10.0-dev.7", 0.3, ines, null],
    ];
    for (const [channel, from, to, days, actor, reason] of history) {
      const downgrade = Boolean(reason);
      await q(
        `INSERT INTO channel_events (channel_id, app_id, action, from_id, to_id, from_version, to_version,
           actor_user_id, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          channels[channel].id,
          app.id,
          downgrade ? "rollback" : "point",
          bundles[from]?.id ?? null,
          bundles[to]?.id ?? null,
          from,
          to,
          actor,
          reason,
          ago(days * DAY),
        ],
      );
      await q(
        `INSERT INTO audit_log (organization_id, app_id, actor_user_id, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, 'channel', $5, $6, $7)`,
        [
          org.id,
          app.id,
          actor,
          downgrade ? "channel.rollback" : "channel.point",
          channels[channel].id,
          JSON.stringify({ channel, from, to, ...(reason ? { reason } : {}) }),
          ago(days * DAY),
        ],
      );
    }
    for (const spec of bundleSpecs)
      await q(
        `INSERT INTO audit_log (organization_id, app_id, actor_user_id, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, 'bundle.upload', 'bundle', $4, $5, $6)`,
        [
          org.id,
          app.id,
          spec.f === "prod" ? karim : ines,
          bundles[spec.v].id,
          JSON.stringify({ version: spec.v, flavour: spec.f, signed: true }),
          ago(spec.days * DAY + 5 * 60_000),
        ],
      );
    await q(
      `INSERT INTO audit_log (organization_id, app_id, actor_user_id, action, target_type, details, created_at)
       VALUES ($1, $2, $3, 'app.signing_key_set', 'app', $4, $5),
              ($1, NULL, $3, 'member.invite', 'organization', $6, $7)`,
      [
        org.id,
        app.id,
        owner,
        JSON.stringify({ require_signature: true }),
        ago(105 * DAY),
        JSON.stringify({ email: "lea.martin@northwind.example", role: "member" }),
        ago(70 * DAY),
      ],
    );

    const pipelineBase = "https://gitlab.northwind.example/mobile/field-sales/-/pipelines";
    const buildSpecs = [
      {
        v: "1.10.0-dev.8",
        f: "dev",
        kind: "ota",
        status: "running",
        source: "gitlab",
        minutes: 3,
        ref: "feature/delivery-proof",
      },
      {
        v: "1.10.0-dev.7",
        f: "dev",
        kind: "ota",
        status: "succeeded",
        source: "gitlab",
        minutes: 7 * 60,
        ref: "feature/delivery-proof",
        bundle: "1.10.0-dev.7",
      },
      {
        v: "1.9.2-rc.2",
        f: "staging",
        kind: "ota",
        status: "succeeded",
        source: "gitlab",
        minutes: 22 * 60,
        ref: "release/1.9.2",
        bundle: "1.9.2-rc.2",
      },
      {
        v: "1.9.2-rc.2",
        f: "staging",
        kind: "ota",
        status: "failed",
        source: "gitlab",
        minutes: 23 * 60,
        ref: "release/1.9.2",
        error: "web: vite build failed, src/modules/returns/PhotoStep.vue: Unexpected token",
      },
      {
        v: "1.9.2-rc.1",
        f: "staging",
        kind: "ota",
        status: "succeeded",
        source: "gitlab",
        minutes: 48 * 60,
        ref: "release/1.9.2",
        bundle: "1.9.2-rc.1",
      },
      {
        v: "1.9.1",
        f: "prod",
        kind: "ota",
        status: "succeeded",
        source: "gitlab",
        minutes: 3 * 24 * 60,
        ref: "main",
        bundle: "1.9.1",
      },
      {
        v: "1.9.0",
        f: "prod",
        kind: "ota",
        status: "succeeded",
        source: "cli",
        minutes: 14 * 24 * 60,
        ref: "main",
        bundle: "1.9.0",
      },
      {
        v: "1.9.0",
        f: "prod",
        kind: "native",
        code: 190,
        status: "succeeded",
        source: "cli",
        minutes: 16 * 24 * 60,
        ref: "main",
        native: "prod-190",
      },
      {
        v: "1.9.0",
        f: "prod",
        kind: "native",
        code: 190,
        status: "failed",
        source: "cli",
        minutes: 16 * 24 * 60 + 40,
        ref: "main",
        error: "sign: the APK is signed with a different certificate than the previous release",
      },
      {
        v: "1.8.2",
        f: "prod",
        kind: "ota",
        status: "succeeded",
        source: "gitlab",
        minutes: 24 * 24 * 60,
        ref: "main",
        bundle: "1.8.2",
      },
    ];
    const stepsFor = (kind) =>
      kind === "native"
        ? ["resolve", "assets", "web", "native-config", "sync", "compile", "sign", "upload"]
        : ["resolve", "web", "native-config", "sync", "bundle", "sign", "upload"];
    let pipelineNumber = 18420;
    for (const spec of buildSpecs) {
      pipelineNumber += between(3, 17);
      const startedAt = ago(spec.minutes * 60_000);
      const durationS = spec.kind === "native" ? between(260, 420) : between(70, 140);
      const finishedAt =
        spec.status === "running" ? null : new Date(startedAt.getTime() + durationS * 1000);
      const sha = checksumOf(`commit-${spec.v}-${spec.minutes}`).slice(0, 40);
      const build = await one(
        `INSERT INTO builds (app_id, channel_id, channel_name, kind, status, version_name, version_code, flavour, source,
           external_id, commit_sha, ref, pipeline_url, actor_user_id, bundle_id, native_id, error, started_at, finished_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $18) RETURNING id`,
        [
          app.id,
          channels[spec.f].id,
          spec.f,
          spec.kind,
          spec.status,
          spec.v,
          spec.code ?? null,
          spec.f,
          spec.source,
          spec.source === "gitlab" ? String(pipelineNumber) : null,
          sha,
          spec.ref,
          spec.source === "gitlab" ? `${pipelineBase}/${pipelineNumber}` : null,
          spec.f === "prod" ? karim : ines,
          spec.bundle ? bundles[spec.bundle].id : null,
          spec.native ? natives[spec.native].id : null,
          spec.error ?? null,
          startedAt,
          finishedAt,
        ],
      );
      const steps = stepsFor(spec.kind);
      const failedAt = spec.error ? steps.indexOf(spec.error.split(":")[0]) : -1;
      const runningAt = spec.status === "running" ? 3 : -1;
      const perStep = durationS / steps.length;
      for (let index = 0; index < steps.length; index++) {
        if (failedAt >= 0 && index > failedAt) break;
        if (runningAt >= 0 && index > runningAt) break;
        const status =
          index === failedAt ? "failed" : index === runningAt ? "running" : "succeeded";
        await q(
          `INSERT INTO build_events (build_id, step, status, message, created_at) VALUES ($1, $2, $3, $4, $5)`,
          [
            build.id,
            steps[index],
            status,
            index === failedAt ? spec.error.split(": ").slice(1).join(": ") : null,
            new Date(startedAt.getTime() + (index + 1) * perStep * 1000),
          ],
        );
      }
    }

    const fleet = [
      { channel: "prod-contoso", count: 46, lag: 0.12, prefix: "CTS" },
      { channel: "prod-fabrikam", count: 38, lag: 0.07, prefix: "FBK" },
      { channel: "prod-tailspin", count: 24, lag: 0.05, prefix: "TSP" },
      { channel: "prod", count: 22, lag: 0.18, prefix: "NW" },
      { channel: "staging", count: 6, lag: 0, prefix: "QA" },
      { channel: "dev", count: 4, lag: 0, prefix: "DEV" },
    ];
    const models = [
      ["samsung", "SM-X216B", "Galaxy Tab A9+"],
      ["samsung", "SM-X306B", "Galaxy Tab Active5"],
      ["LENOVO", "TB-X606F", "Lenovo Tab M10 Plus"],
      ["Xiaomi", "23073RPBFG", "Redmi Pad SE"],
      ["Zebra Technologies", "ET45", "Zebra ET45"],
      ["Honeywell", "CT45", "Honeywell CT45"],
      ["samsung", "SM-A155F", "Galaxy A15"],
    ];
    const osVersions = ["11", "12", "13", "13", "14", "14"];
    const cities = [
      [36.7538, 3.0588],
      [35.6971, -0.6308],
      [36.365, 6.6147],
      [36.19, 5.41],
      [35.2, 0.63],
      [36.47, 2.83],
    ];
    const previousOf = {
      "1.9.1": "1.9.0",
      "1.9.0": "1.8.2",
      "1.8.2": "1.8.1",
      "1.9.2-rc.2": "1.9.2-rc.1",
      "1.10.0-dev.7": "1.10.0-dev.6",
    };
    const devices = [];
    let serial = 100;
    for (const group of fleet) {
      const channel = channels[group.channel];
      const current = channel.bundle;
      for (let index = 0; index < group.count; index++) {
        serial += between(1, 9);
        const [manufacturer, model, label] = pick(models);
        const lagging = random() < group.lag;
        const version = lagging ? (previousOf[current] ?? current) : current;
        const nativeKey = channel.native ?? "prod-170";
        const native = natives[nativeKey] ?? natives["prod-170"];
        const stale = random() < 0.06;
        const seenAgo = stale ? between(4, 18) * DAY : between(4, 44 * 60) * 60_000;
        const [lat, lng] = pick(cities);
        const located = random() < 0.7;
        const repId = `${group.prefix}-${String(serial).padStart(4, "0")}`;
        const row = await one(
          `INSERT INTO devices (app_id, device_id, custom_id, platform, is_prod, is_emulator, version_name, version_builtin,
             version_code, version_os, plugin_version, reported_channel, channel_id, assigned_channel_id, device_name,
             manufacturer, model, mem_used_bytes, latitude, longitude, location_accuracy_m, location_reported_at,
             last_seen_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'android', $4, false, $5, $6, $7, $8, '8.51.0', $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $20)
           RETURNING id`,
          [
            app.id,
            randomUUID(),
            repId,
            group.channel !== "dev",
            version,
            native.version,
            native.code,
            pick(osVersions),
            group.channel.startsWith("prod-") ? "prod" : group.channel,
            channel.id,
            group.channel.startsWith("prod-") ? channel.id : null,
            label,
            manufacturer,
            model,
            between(180, 420) * 1_048_576,
            located ? lat + (random() - 0.5) * 0.35 : null,
            located ? lng + (random() - 0.5) * 0.35 : null,
            located ? between(8, 60) : null,
            located ? ago(seenAgo) : null,
            ago(seenAgo),
            ago(between(20, 100) * DAY),
          ],
        );
        devices.push({ id: row.id, channel: channel.id, version, lagging, stale, seenAgo });
      }
    }

    const events = [];
    const moves = history.map(([channel, , to, days]) => ({
      channel: channels[channel].id,
      to,
      days,
    }));
    for (const device of devices) {
      const lastDay = Math.floor(device.seenAgo / DAY);
      for (let day = 27; day >= lastDay; day--) {
        const checks = between(2, 6);
        for (let n = 0; n < checks; n++)
          events.push([
            device.id,
            device.channel,
            "check",
            "get",
            "check",
            device.version,
            null,
            null,
            ago(day * DAY + between(7, 18) * HOUR + between(0, 59) * 60_000),
          ]);
      }
      for (const move of moves.filter(
        (entry) => entry.channel === device.channel && entry.days <= 27,
      )) {
        if (device.lagging && move.to === device.version) continue;
        if (device.seenAgo > move.days * DAY) continue;
        const when = Math.max(device.seenAgo, (move.days - random() * 0.6) * DAY);
        if (random() < 0.035)
          events.push([
            device.id,
            device.channel,
            "ota",
            "download_fail",
            "failed",
            null,
            move.to,
            "Connection reset while downloading",
            ago(when + 20 * 60_000),
          ]);
        events.push([
          device.id,
          device.channel,
          "ota",
          "set",
          "delivered",
          null,
          move.to,
          null,
          ago(when),
        ]);
      }
    }
    for (let start = 0; start < events.length; start += 500) {
      const chunk = events.slice(start, start + 500);
      const values = [];
      const params = [];
      chunk.forEach((event, index) => {
        const base = index * 9;
        values.push(
          `($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`,
        );
        params.push(...event);
      });
      await q(
        `INSERT INTO device_events (app_id, device_uuid, channel_id, kind, action, status, version_from, version_to, error, created_at)
         VALUES ${values.join(", ")}`,
        [app.id, ...params],
      );
    }

    await q(
      `INSERT INTO app_config (app_id, environment, channel, key, value, value_type) VALUES
         ($1, 'all', NULL, 'orders.offline_queue_limit', '500', 'number'),
         ($1, 'prod', NULL, 'catalogue.sync_interval_minutes', '30', 'number'),
         ($1, 'prod', 'prod-contoso', 'features.stock_reservation', 'true', 'boolean'),
         ($1, 'dev', NULL, 'features.delivery_proof', 'true', 'boolean')`,
      [app.id],
    );
    await q(
      `INSERT INTO integrations (app_id, kind, secret_hash, config, last_event_at) VALUES ($1, 'gitlab', $2, $3, $4)`,
      [
        app.id,
        checksumOf(randomBytes(32).toString("hex")),
        JSON.stringify({ project: "mobile/field-sales" }),
        ago(3 * 60_000),
      ],
    );

    await q("COMMIT");
    process.stdout.write(
      `Seeded Northwind Distribution: ${devices.length} devices, ${events.length} device events, ${buildSpecs.length} builds. Sign in as ${email}.\n`,
    );
  } catch (error) {
    await q("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
