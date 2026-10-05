import type { MigrationSet } from "@cavulsqa/mobile-db";
import { sql } from "kysely";

/**
 * Keys are ordered lexically and recorded once applied, so they are numbered and never renamed:
 * renaming one makes it run again on a database that already has it.
 *
 * Indexed on what screens filter by: an app's channels and builds, activity by time and app.
 */
export const migrations: MigrationSet = {
  "001_capuchoo": {
    up: async (db) => {
      await db.schema
        .createTable("account")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("email", "text", (col) => col.notNull())
        .addColumn("full_name", "text", (col) => col.notNull().defaultTo(""))
        .addColumn("instance_admin", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("endpoint", "text", (col) => col.notNull())
        .addColumn("synced_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("organization")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("slug", "text", (col) => col.notNull().defaultTo(""))
        .addColumn("role", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("app")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("bundle_id", "text", (col) => col.notNull())
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("organization_id", "text", (col) => col.notNull())
        .addColumn("platform", "text", (col) => col.notNull().defaultTo("all"))
        .addColumn("role", "text", (col) => col.notNull())
        .addColumn("prod_role", "text", (col) => col.notNull().defaultTo("admin"))
        .addColumn("icon_url", "text")
        .addColumn("channel_count", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("device_count", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("native_count", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("bundle_count", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("notify", "integer", (col) => col.notNull().defaultTo(1))
        .addColumn("synced_at", "text")
        .execute();

      await db.schema
        .createTable("app_identifier")
        .addColumn("app_id", "text", (col) =>
          col.notNull().references("app.id").onDelete("cascade"),
        )
        .addColumn("bundle_id", "text", (col) => col.notNull())
        .addColumn("flavour", "text")
        .addPrimaryKeyConstraint("pk_app_identifier", ["app_id", "bundle_id"])
        .execute();

      await db.schema
        .createTable("channel")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) =>
          col.notNull().references("app.id").onDelete("cascade"),
        )
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("environment", "text")
        .addColumn("kind", "text", (col) => col.notNull().defaultTo("release"))
        .addColumn("base_channel_id", "text")
        .addColumn("paused", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("current_native_id", "text")
        .addColumn("current_bundle_id", "text")
        .addColumn("updated_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("native_build")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) =>
          col.notNull().references("app.id").onDelete("cascade"),
        )
        .addColumn("version_name", "text", (col) => col.notNull())
        .addColumn("version_code", "integer", (col) => col.notNull())
        .addColumn("flavour", "text")
        .addColumn("size_bytes", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("checksum", "text")
        .addColumn("signed", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("signing_cert_sha256", "text")
        .addColumn("required", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("release_notes", "text")
        .addColumn("min_sdk", "integer")
        .addColumn("channels", "text", (col) => col.notNull().defaultTo("[]"))
        .addColumn("created_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("bundle")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) =>
          col.notNull().references("app.id").onDelete("cascade"),
        )
        .addColumn("version_name", "text", (col) => col.notNull())
        .addColumn("flavour", "text")
        .addColumn("size_bytes", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("required", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("release_notes", "text")
        .addColumn("min_native_version", "integer")
        .addColumn("channels", "text", (col) => col.notNull().defaultTo("[]"))
        .addColumn("created_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("installed")
        .addColumn("bundle_id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) => col.notNull())
        .addColumn("installed", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("version_name", "text")
        .addColumn("version_code", "integer")
        .addColumn("updated_at", "text")
        .addColumn("checked_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("activity")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) => col.notNull())
        .addColumn("kind", "text", (col) => col.notNull())
        .addColumn("version_name", "text")
        .addColumn("version_code", "integer")
        .addColumn("channel_name", "text")
        .addColumn("environment", "text")
        .addColumn("detail", "text")
        .addColumn("created_at", "text", (col) => col.notNull())
        .addColumn("read_at", "text")
        .execute();

      for (const [name, table, columns] of [
        ["idx_channel_app", "channel", ["app_id"]],
        ["idx_native_app_code", "native_build", ["app_id", "version_code"]],
        ["idx_bundle_app", "bundle", ["app_id", "created_at"]],
        ["idx_installed_app", "installed", ["app_id"]],
        ["idx_activity_time", "activity", ["created_at"]],
        ["idx_activity_app", "activity", ["app_id", "created_at"]],
      ] as const) {
        await db.schema
          .createIndex(name)
          .on(table)
          .columns([...columns])
          .execute();
      }

      await sql`PRAGMA foreign_keys = ON`.execute(db);
    },
  },
  "002_insights": {
    up: async (db) => {
      await db.schema
        .createTable("device")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("app_id", "text", (col) => col.notNull())
        .addColumn("device_id", "text", (col) => col.notNull())
        .addColumn("custom_id", "text")
        .addColumn("platform", "text", (col) => col.notNull())
        .addColumn("is_prod", "integer")
        .addColumn("is_emulator", "integer")
        .addColumn("version_name", "text")
        .addColumn("version_code", "integer")
        .addColumn("version_os", "text")
        .addColumn("plugin_version", "text")
        .addColumn("channel_id", "text")
        .addColumn("assigned_channel_id", "text")
        .addColumn("channel_name", "text")
        .addColumn("device_name", "text")
        .addColumn("manufacturer", "text")
        .addColumn("model", "text")
        .addColumn("last_seen_at", "text", (col) => col.notNull())
        .addColumn("created_at", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("app_stats")
        .addColumn("app_id", "text", (col) => col.notNull())
        .addColumn("days", "integer", (col) => col.notNull())
        .addColumn("payload", "text", (col) => col.notNull())
        .addColumn("synced_at", "text", (col) => col.notNull())
        .addPrimaryKeyConstraint("pk_app_stats", ["app_id", "days"])
        .execute();

      await db.schema
        .createIndex("idx_device_app_seen")
        .on("device")
        .columns(["app_id", "last_seen_at"])
        .execute();
    },
  },
};
