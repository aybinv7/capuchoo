import { z } from "zod";

export const appArg = z
  .string()
  .min(1)
  .max(200)
  .describe("The app: its id, or its bundle identifier such as com.acme.fieldsales.");

export const channelArg = z
  .string()
  .min(1)
  .max(100)
  .describe("A channel id, or its name such as prod-contoso (then `app` is required).");

export const deviceArg = z
  .string()
  .min(1)
  .max(200)
  .describe("A device id from Capuchoo, or the id the device reports (then `app` is required).");

export const optionalApp = appArg
  .optional()
  .describe("The app, when a channel or device is named rather than given by id.");

export const uuidArg = (what: string) => z.string().uuid().describe(`The ${what}'s id.`);

export const limitArg = (fallback: number, max: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(fallback)
    .describe(`How many to return, at most ${max}.`);

export const reasonArg = z
  .string()
  .min(3)
  .max(500)
  .describe("Why, in a sentence. It is shown in the channel's history and the audit log.");

export const confirmationArg = z
  .string()
  .max(400)
  .optional()
  .describe(
    "The confirmation token from this tool's preview. Leave it out to get the preview first.",
  );

export const channelNameArg = z
  .string()
  .max(100)
  .optional()
  .describe("For a production channel: the channel's name typed out, as the dashboard asks.");
