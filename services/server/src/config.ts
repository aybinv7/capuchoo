import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((value) => value === "true" || value === "1" || value === "yes");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default("0.0.0.0"),
    PUBLIC_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_SSL: bool.optional(),
    MIGRATE_ON_BOOT: bool.default(true),
    SECRET_KEY: z.string().min(32, "SECRET_KEY must be at least 32 characters"),
    SIGNUP: z.enum(["closed", "open"]).default("closed"),
    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_SECURE: bool.optional(),
    ALLOWED_ORIGINS: z.string().default(""),
    STORAGE_DRIVER: z.enum(["fs", "s3", "postgres"]).default("fs"),
    STORAGE_DIR: z.string().default("./data/artefacts"),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    ARTEFACT_URL_TTL: z.coerce.number().int().positive().default(3600),
    MAX_BUNDLE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(200 * 1024 * 1024),
    MAX_NATIVE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(400 * 1024 * 1024),
    DEVICE_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    DASHBOARD_DIR: z.string().optional(),
    TRUST_PROXY: bool.default(false),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((value, context) => {
    if (value.STORAGE_DRIVER === "s3") {
      for (const key of [
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
      ] as const) {
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: "required when STORAGE_DRIVER=s3",
          });
      }
    }
    if (Boolean(value.BOOTSTRAP_ADMIN_EMAIL) !== Boolean(value.BOOTSTRAP_ADMIN_PASSWORD)) {
      context.addIssue({
        code: "custom",
        path: ["BOOTSTRAP_ADMIN_PASSWORD"],
        message: "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD go together",
      });
    }
  });

export type Config = z.infer<typeof schema> & { allowedOrigins: string[] };

/** Parses the environment once; a bad value stops the process with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${problems.join("\n")}`);
  }
  return {
    ...parsed.data,
    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
