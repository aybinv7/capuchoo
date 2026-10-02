import {
  generateReleaseKeyPair,
  signRelease,
  type AppRole,
  type Environment,
} from "@capuchoo/core";
import { DAY, MINUTE, checksumOf } from "./dice";
import { ago, type DemoContext, type PersonKey } from "./context";

export interface NativeSpec {
  key: string;
  version: string;
  code: number;
  flavour: Environment;
  days: number;
  required?: boolean;
  notes: string;
}

export interface BundleSpec {
  version: string;
  flavour: Environment;
  days: number;
  minNative?: number;
  notes: string;
}

export interface ChannelSpec {
  name: string;
  environment: Environment;
  bundle: string | null;
  native: string | null;
  base?: string;
  selfSet?: boolean;
  paused?: boolean;
}

export interface MoveSpec {
  channel: string;
  from: string | null;
  to: string;
  days: number;
  actor: PersonKey;
  /** A rollback, and why. */
  rollback?: string;
}

export interface PauseSpec {
  channel: string;
  days: number;
  actor: PersonKey;
  reason: string;
}

export interface ConfigSpec {
  environment: "all" | Environment;
  channel: string | null;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
}

export interface AppCatalog {
  appId: string;
  name: string;
  createdDays: number;
  prodRole: "admin" | "developer";
  permissions: Array<[PersonKey, AppRole]>;
  natives: NativeSpec[];
  bundles: BundleSpec[];
  channels: ChannelSpec[];
  moves: MoveSpec[];
  pauses: PauseSpec[];
  config: ConfigSpec[];
  /** Who uploads a flavour's releases. */
  uploader: (flavour: Environment) => PersonKey;
}

export interface SeededApp {
  id: string;
  catalog: AppCatalog;
  bundles: Map<string, { id: string; spec: BundleSpec }>;
  natives: Map<string, { id: string; spec: NativeSpec }>;
  channels: Map<string, { id: string; spec: ChannelSpec }>;
}

/** One app with signed artefacts, channels that point at them, and the history that got them there. */
export async function seedCatalog(context: DemoContext, catalog: AppCatalog): Promise<SeededApp> {
  const { trx, people, organizationId } = context;
  const keys = await generateReleaseKeyPair();
  const app = await trx
    .insertInto("apps")
    .values({
      organization_id: organizationId,
      app_id: catalog.appId,
      name: catalog.name,
      platform: "android",
      public_key: keys.publicKey,
      require_signature: true,
      prod_role: catalog.prodRole,
      created_at: ago(context, catalog.createdDays * DAY),
      updated_at: context.now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await trx
    .insertInto("app_identifiers")
    .values({ app_id: app.id, bundle_id: catalog.appId, platform: "android" })
    .execute();
  if (catalog.permissions.length > 0) {
    await trx
      .insertInto("app_permissions")
      .values(
        catalog.permissions.map(([person, role]) => ({
          app_id: app.id,
          user_id: people[person],
          role,
        })),
      )
      .execute();
  }

  const seeded: SeededApp = {
    id: app.id,
    catalog,
    bundles: new Map(),
    natives: new Map(),
    channels: new Map(),
  };
  const certificate = checksumOf(`${catalog.appId}-release-certificate`);

  for (const spec of catalog.natives) {
    const checksum = checksumOf(`${catalog.appId}-native-${spec.key}`);
    const row = await trx
      .insertInto("native_builds")
      .values({
        app_id: app.id,
        platform: "android",
        version_name: spec.version,
        version_code: spec.code,
        flavour: spec.flavour,
        storage_key: `demo/${catalog.appId}/native/${spec.key}.apk`,
        size_bytes: context.dice.between(31, 36) * 1_048_576 + context.dice.between(0, 900_000),
        checksum,
        signature: await signRelease(
          {
            kind: "native",
            appId: catalog.appId,
            platform: "android",
            version: spec.version,
            versionCode: spec.code,
            sha256: checksum,
          },
          keys.privateKey,
        ),
        signing_cert_sha256: certificate,
        required: spec.required ?? false,
        release_notes: spec.notes,
        min_sdk: 26,
        uploaded_by: people[catalog.uploader(spec.flavour)],
        created_at: ago(context, spec.days * DAY),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    seeded.natives.set(spec.key, { id: row.id, spec });
  }

  for (const spec of catalog.bundles) {
    const checksum = checksumOf(`${catalog.appId}-bundle-${spec.version}`);
    const row = await trx
      .insertInto("bundles")
      .values({
        app_id: app.id,
        platform: "android",
        version_name: spec.version,
        flavour: spec.flavour,
        storage_key: `demo/${catalog.appId}/ota/${spec.version}.zip`,
        size_bytes: context.dice.between(3, 6) * 1_048_576 + context.dice.between(0, 900_000),
        checksum,
        signature: await signRelease(
          {
            kind: "ota",
            appId: catalog.appId,
            platform: "android",
            version: spec.version,
            sha256: checksum,
          },
          keys.privateKey,
        ),
        min_native_version: spec.minNative ?? null,
        release_notes: spec.notes,
        uploaded_by: people[catalog.uploader(spec.flavour)],
        created_at: ago(context, spec.days * DAY),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    seeded.bundles.set(spec.version, { id: row.id, spec });
  }

  for (const spec of catalog.channels) {
    const base = spec.base ? seeded.channels.get(spec.base) : undefined;
    const row = await trx
      .insertInto("channels")
      .values({
        app_id: app.id,
        name: spec.name,
        environment: spec.environment,
        kind: base ? "client" : "release",
        base_channel_id: base?.id ?? null,
        allow_device_self_set: spec.selfSet ?? false,
        is_public: spec.name === "prod",
        paused: spec.paused ?? false,
        current_bundle_id: spec.bundle ? (seeded.bundles.get(spec.bundle)?.id ?? null) : null,
        current_native_id: spec.native ? (seeded.natives.get(spec.native)?.id ?? null) : null,
        created_at: ago(context, (catalog.createdDays - 5) * DAY),
        updated_at: context.now,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    seeded.channels.set(spec.name, { id: row.id, spec });
  }

  await seedHistory(context, seeded);
  await seedConfig(context, seeded);
  return seeded;
}

async function seedHistory(context: DemoContext, seeded: SeededApp): Promise<void> {
  const { trx, people, organizationId } = context;
  const events = [];
  const audits = [];
  for (const move of seeded.catalog.moves) {
    const channel = seeded.channels.get(move.channel);
    if (!channel) continue;
    const at = ago(context, move.days * DAY);
    events.push({
      channel_id: channel.id,
      app_id: seeded.id,
      action: move.rollback ? ("rollback_bundle" as const) : ("point_bundle" as const),
      from_id: move.from ? (seeded.bundles.get(move.from)?.id ?? null) : null,
      to_id: seeded.bundles.get(move.to)?.id ?? null,
      from_version: move.from,
      to_version: move.to,
      actor_user_id: people[move.actor],
      reason: move.rollback ?? null,
      created_at: at,
    });
    audits.push({
      organization_id: organizationId,
      app_id: seeded.id,
      actor_user_id: people[move.actor],
      action: move.rollback ? "channel.rollback_bundle" : "channel.point_bundle",
      target_type: "channel",
      target_id: channel.id,
      details: JSON.stringify({
        channel: move.channel,
        from: move.from,
        to: move.to,
        ...(move.rollback ? { reason: move.rollback } : {}),
      }),
      created_at: at,
    });
  }
  for (const pause of seeded.catalog.pauses) {
    const channel = seeded.channels.get(pause.channel);
    if (!channel) continue;
    const at = ago(context, pause.days * DAY);
    events.push({
      channel_id: channel.id,
      app_id: seeded.id,
      action: "pause" as const,
      from_id: null,
      to_id: null,
      from_version: null,
      to_version: null,
      actor_user_id: people[pause.actor],
      reason: pause.reason,
      created_at: at,
    });
    audits.push({
      organization_id: organizationId,
      app_id: seeded.id,
      actor_user_id: people[pause.actor],
      action: "channel.pause",
      target_type: "channel",
      target_id: channel.id,
      details: JSON.stringify({ channel: pause.channel, reason: pause.reason }),
      created_at: at,
    });
  }
  for (const spec of seeded.catalog.bundles) {
    audits.push({
      organization_id: organizationId,
      app_id: seeded.id,
      actor_user_id: people[seeded.catalog.uploader(spec.flavour)],
      action: "bundle.upload",
      target_type: "bundle",
      target_id: seeded.bundles.get(spec.version)?.id ?? null,
      details: JSON.stringify({ version: spec.version, flavour: spec.flavour, signed: true }),
      created_at: ago(context, spec.days * DAY - 4 * MINUTE),
    });
  }
  if (events.length > 0) await trx.insertInto("channel_events").values(events).execute();
  if (audits.length > 0) await trx.insertInto("audit_log").values(audits).execute();
}

async function seedConfig(context: DemoContext, seeded: SeededApp): Promise<void> {
  if (seeded.catalog.config.length === 0) return;
  await context.trx
    .insertInto("app_config")
    .values(
      seeded.catalog.config.map((entry) => ({
        app_id: seeded.id,
        environment: entry.environment,
        channel: entry.channel,
        key: entry.key,
        value: entry.value,
        value_type: entry.type,
        created_at: context.now,
        updated_at: context.now,
      })),
    )
    .execute();
}
