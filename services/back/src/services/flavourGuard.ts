import { describeUploadFlavourMismatch, isFlavour, isFlavourAllowed } from "@capuchoo/core";
import { ConflictError } from "@/types";
import supabaseService from "./supabaseService";
import logger from "@/utils/logger";

/**
 * Refuses an artefact whose flavour contradicts the channel it is bound for.
 *
 * The invariant this keeps: every artefact on a channel came from one flavour.
 * With that held at upload, serving needs no inference at all - which is what
 * replaced reading a flavour off the end of a bundle identifier. Upload is also
 * the only moment the flavour is known for certain, because the CLI has just
 * built it.
 *
 * Silent in two cases, both deliberate: the caller declared no flavour (an older
 * CLI must keep publishing), or the channel is bound to none (nothing to
 * contradict).
 *
 * Called before the artefact reaches storage. Both upload paths resolve the
 * channel pointer only after uploading, so a mismatch found there would have
 * already spent the bandwidth and left an orphan object behind.
 */
export async function assertFlavourMatchesChannel(
  appUuid: string,
  channelName: string,
  declared: unknown,
): Promise<void> {
  if (!isFlavour(declared)) return;

  const { data } = await supabaseService
    .getClient()
    .from("channels")
    .select("name, environment")
    .eq("app_id", appUuid)
    .eq("name", channelName)
    .maybeSingle();

  const channelFlavour = data?.environment;
  if (!isFlavour(channelFlavour)) return;

  if (!isFlavourAllowed(declared, channelFlavour)) {
    throw new ConflictError(
      describeUploadFlavourMismatch(data?.name ?? channelName, channelFlavour, declared),
    );
  }
}

/**
 * Inserts a row, dropping `flavour` and retrying if the column is not there yet.
 *
 * The CLI declares a flavour on every upload from 0.10.0, and the column arrives
 * with migration 008. Deployed in that order without this, every publish would
 * fail on `column "flavour" does not exist` - the same shape as naming a missing
 * column in a select and rejecting every API key, which this project has already
 * done once.
 *
 * Two error shapes, because the write may be refused by either layer:
 *
 *   42703    PostgreSQL undefined_column, if the statement reaches the database.
 *   PGRST204 PostgREST, which checks its own schema cache first and answers
 *            "Could not find the 'flavour' column of 'app_versions'". This is
 *            the one that actually occurs, and matching only on the PostgreSQL
 *            wording let a live publish fail with a 500 - found by trying it.
 */
export async function insertTolerantOfFlavour(
  table: string,
  row: Record<string, unknown>,
): Promise<any> {
  try {
    return await supabaseService.insert(table, [row]);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : String(error);

    const missingColumn =
      code === "42703" ||
      code === "PGRST204" ||
      (/flavour/i.test(message) && /does not exist|could not find/i.test(message));

    if (!missingColumn || row.flavour === undefined) throw error;

    logger.warn("Storing without the flavour column - migration 008 has not run", { table });

    const { flavour: _dropped, ...rest } = row;
    return supabaseService.insert(table, [rest]);
  }
}
