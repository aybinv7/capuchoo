import { describeFlavourMismatch, isFlavour, isFlavourAllowed } from "@capuchoo/core";
import type { ApkManifest } from "../pipeline/android-manifest.js";
import type { RegisteredIdentifier } from "../pipeline/deploy.js";
import type { AppArtefacts } from "../services/wire.js";
import {
  describeChannel,
  isDevChannel,
  isProtectedChannel,
  type ChannelClass,
} from "./channel-class.js";
import { nextPublishedCode } from "./release-version.js";

export interface PrebuiltFacts {
  file: string;
  manifest: ApkManifest;
  signed: boolean;
  channel: ChannelClass;
  /** Undefined when the server could not list them; the identifier is then not checked. */
  identifiers: RegisteredIdentifier[] | undefined;
  artefacts: AppArtefacts | null;
  allowUnsigned: boolean;
}

/**
 * Why an APK built elsewhere may not be published to this channel. The version is the one
 * compiled into the file, because that is what the device will report once it is installed.
 */
export function describePrebuiltProblems(facts: PrebuiltFacts): string[] {
  const { manifest, channel } = facts;
  const problems: string[] = [];
  const name = `${manifest.applicationId} ${manifest.versionName ?? "?"} (${manifest.versionCode})`;

  if (!manifest.versionName)
    problems.push(`${facts.file} declares no versionName; set versionName in its Gradle build`);

  if (!facts.signed && !(facts.allowUnsigned && isDevChannel(channel)))
    problems.push(
      `${facts.file} is not signed, so Android will refuse to install it. ` +
        (isDevChannel(channel)
          ? "Sign it, or pass --allow-unsigned on this dev channel."
          : `Sign it with the release key before publishing to ${describeChannel(channel)}.`),
    );

  if (manifest.debuggable && isProtectedChannel(channel))
    problems.push(
      `${name} is a debuggable build, and ${describeChannel(channel)} serves field devices. ` +
        "Publish a release build.",
    );

  if (facts.identifiers) {
    const registered = facts.identifiers.find((row) => row.bundle_id === manifest.applicationId);
    if (!registered)
      problems.push(
        `${manifest.applicationId} is not registered for this app. Register it with: ` +
          `capuchoo app identifier add ${manifest.applicationId} --flavour ${channel.environment}`,
      );
    else if (
      !isFlavourAllowed(
        isFlavour(registered.flavour) ? registered.flavour : null,
        channel.environment,
      )
    )
      problems.push(
        describeFlavourMismatch(
          manifest.applicationId,
          registered.flavour as ChannelClass["environment"],
          channel.environment,
          channel.name,
        ),
      );
  }

  const next = nextPublishedCode(facts.artefacts, "android", channel.environment);
  if (manifest.versionCode < next)
    problems.push(
      `${name} is not above build ${next - 1}, already published for ${channel.environment}. ` +
        `Android only installs a higher versionCode: build with versionCode ${next} or more.`,
    );

  return problems;
}
