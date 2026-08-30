/**
 * Refuses a bundle gated behind a native build its channel cannot serve.
 *
 * `min_update_version` is the one thing that stops a web bundle landing on a
 * binary too old to run it - the case where a native release and an OTA release
 * are published together, a device takes the bundle, and the plugin or
 * permission it now depends on is not in the installed APK. `decideUpdate`
 * honours it and offers the binary instead.
 *
 * Its own failure mode is silent. If no native release at or above the line is
 * assigned to the channel, the server looks for the binary to offer, finds
 * none, and answers `native_update: null`; `resolveUpdate` reads that as "no
 * update at all". The device is not crashed - it is frozen. It never takes the
 * bundle, is never told why, and the release still reads as published. Every
 * device on the channel stops updating and nothing anywhere says so.
 *
 * Which is why this runs where the gate is written, not where it is read: at
 * the upload and at the promote, the only two moments there is a person to tell
 * and an operation to refuse.
 */

import { checkNativeGate, type NativeGate } from "@capuchoo/core";
import { ValidationError } from "@/types";
import supabaseService from "./supabaseService";

/**
 * The build number of the native release a channel currently serves.
 *
 * `channels.current_native_version_id` decides this, not a row's own `active`
 * flag - the same pointer `findAssignedNative` reads when serving an update, so
 * this guard and the decision agree about what the channel offers.
 */
async function channelNativeCode(appUuid: string, channelName: string): Promise<number | null> {
  const { data: channel } = await supabaseService
    .getClient()
    .from("channels")
    .select("current_native_version_id")
    .eq("app_id", appUuid)
    .eq("name", channelName)
    .maybeSingle();

  const nativeId = channel?.current_native_version_id;
  if (!nativeId) return null;

  const { data: native } = await supabaseService
    .getClient()
    .from("native_updates")
    .select("version_code")
    .eq("id", nativeId)
    .maybeSingle();

  const code = native?.version_code;
  return typeof code === "number" ? code : null;
}

/**
 * Throws when the gate is malformed or the channel cannot satisfy it.
 *
 * Ungated bundles - the overwhelming majority - cost one comparison and no
 * query.
 */
export async function assertNativeGateSatisfiable(
  appUuid: string,
  channelName: string,
  gate: NativeGate,
): Promise<void> {
  const ungated = checkNativeGate({ gate, channelNativeCode: null, channelName });
  if (ungated.ok && ungated.gate === null) return;

  const verdict = checkNativeGate({
    gate,
    channelNativeCode: await channelNativeCode(appUuid, channelName),
    channelName,
  });

  if (!verdict.ok) throw new ValidationError(verdict.problem);
}
