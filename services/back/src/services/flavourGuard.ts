import { describeUploadFlavourMismatch, isFlavour, isFlavourAllowed } from "@capuchoo/core";
import { ConflictError } from "@/types";
import supabaseService from "./supabaseService";

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
