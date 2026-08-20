import dotenv from "dotenv";
import Joi from "joi";
import { ServerConfig } from "@/types";
import { keyWarnings, resolveSupabaseKeys } from "./keys";

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3000),

  SUPABASE_URL: Joi.string().uri().required(),
  // Current names. Which key goes in which slot is a privilege decision, not a
  // naming one - see config/keys.ts.
  SUPABASE_PUBLISHABLE_KEY: Joi.string().optional(),
  SUPABASE_SECRET_KEY: Joi.string().optional(),
  // Deprecated by Supabase (removal announced for end of 2026). Still accepted
  // so an environment can be migrated without a deploy in between.
  SUPABASE_KEY: Joi.string().optional(),
  SUPABASE_SERVICE_KEY: Joi.string().optional(),
  BUCKET_NAME: Joi.string().default("updates"),

  CORS_ORIGIN: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).default("*"),

  MAX_FILE_SIZE: Joi.number().default(100 * 1024 * 1024), // 100MB
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(
    `Environment variable validation error: ${error.details.map((d) => d.message).join(", ")}`,
  );
}

const keys = resolveSupabaseKeys(envVars);

for (const warning of keyWarnings(keys)) {
  // Not through @/utils/logger: that module imports this one.
  console.warn(`[config] ${warning}`);
}

const config: ServerConfig = {
  port: envVars.PORT,
  supabase: {
    url: envVars.SUPABASE_URL,
    publishableKey: keys.publishableKey,
    secretKey: keys.secretKey,
    bucketName: envVars.BUCKET_NAME,
  },
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000, // limit each IP to 100 requests per windowMs
    },
    cors: {
      origin: envVars.CORS_ORIGIN,
      credentials: false, // Set to true if you need credentials
    },
  },
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedMimeTypes: [
      "application/zip",
      "application/octet-stream",
      "application/x-zip-compressed",
    ],
  },
};

if (!config.supabase.url) {
  throw new Error("SUPABASE_URL is required");
}

export default config;

export const { port, supabase, security, upload } = config;
