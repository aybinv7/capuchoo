import { generateReleaseKeyPair, publicKeyFingerprint } from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, log, whileWaiting } from "../../cli/prompts.js";
import { requireSession } from "../../cli/session.js";
import { ensureIgnored } from "../../signing/ensure-ignored.js";
import { flavourKeyReport, publicKeyLine } from "../../signing/flavour-keys.js";
import {
  loadReleaseKey,
  SIGNING_KEY_ENV,
  SIGNING_KEY_FILE,
  writeReleaseKey,
  type ReleaseKey,
} from "../../signing/release-key.js";

const PENDING = {
  missing: "not set",
  different: "has a different key",
  "no-file": "file missing",
} as const;

export default class KeysInit extends BaseCommand {
  static override description =
    "Create this app's release signing key, git-ignore it, and upload its public key";

  static override examples = [
    "<%= config.bin %> keys init",
    "<%= config.bin %> keys init --yes --json",
    "<%= config.bin %> keys init --no-require-signature",
    "<%= config.bin %> keys init --force",
  ];

  static override flags = {
    "require-signature": Flags.boolean({
      default: true,
      allowNo: true,
      description: "Make the server refuse unsigned uploads for this app",
    }),
    force: Flags.boolean({
      default: false,
      description:
        "Replace an existing key. Builds that bake the old public key reject everything the new one signs",
    }),
    yes: Flags.boolean({ char: "y", default: false, description: "Accept every prompt" }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysInit);
    const { appDir, project, cloud } = requireSession();

    const existing = await loadReleaseKey(appDir).catch((error: unknown) => {
      if (flags.force) return null;
      throw error;
    });

    if (existing?.source === "environment" && flags.force) {
      this.error(
        `${SIGNING_KEY_ENV} is set, so the key is not this command's to replace. Unset it first.`,
      );
    }

    let key: ReleaseKey;
    let created = false;

    if (existing && !flags.force) {
      key = existing;
      log.info(
        `Using the existing key ${key.fingerprint} from ${key.file ? SIGNING_KEY_FILE : SIGNING_KEY_ENV}.`,
      );
    } else {
      if (existing) {
        log.warn(
          `Replacing key ${existing.fingerprint}. Installed builds that bake its public key will reject every release the new key signs.`,
        );
        const proceed =
          flags.yes ||
          (await confirm("Replace the signing key?", { default: false, flag: "--yes" }));
        if (!proceed) this.error("Cancelled. Nothing was changed.");
      }

      await ensureIgnored(appDir, SIGNING_KEY_FILE, flags.yes);
      const pair = await generateReleaseKeyPair();
      const file = writeReleaseKey(appDir, pair.privateKey);
      key = {
        ...pair,
        fingerprint: await publicKeyFingerprint(pair.publicKey),
        source: "file",
        file,
      };
      created = true;
    }

    await whileWaiting(
      "Uploading the public key...",
      cloud.setSigning(project.cloudAppId, {
        public_key: key.publicKey,
        require_signature: flags["require-signature"],
      }),
    ).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${created ? `The key was saved to ${SIGNING_KEY_FILE}, but u` : "U"}ploading its public key failed: ${reason}\n` +
          "  Run capuchoo keys init again; it reuses the saved key.",
      );
    });

    const flavours = flavourKeyReport(appDir, project, key.publicKey);

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            ok: true,
            created,
            fingerprint: key.fingerprint,
            publicKey: key.publicKey,
            source: key.source,
            file: key.file ? SIGNING_KEY_FILE : null,
            requireSignature: flags["require-signature"],
            flavours,
          },
          null,
          2,
        ),
      );
      return;
    }

    this.log("");
    this.log(
      `  ${chalk.green(created ? "Created" : "Uploaded")} release key ${chalk.bold(key.fingerprint)}`,
    );
    if (created)
      this.log(chalk.dim(`  Private key: ${SIGNING_KEY_FILE} (owner-only, git-ignored)`));
    this.log(
      chalk.dim(
        `  Unsigned uploads are ${flags["require-signature"] ? "now refused" : "still accepted"} for ${project.appName}.`,
      ),
    );
    this.log("");
    this.log("  Add this line to each flavour file so builds verify what they install:");
    this.log("");
    this.log(`  ${publicKeyLine(key.publicKey)}`);
    this.log("");
    for (const flavour of flavours) {
      if (flavour.state === "matches") continue;
      this.log(chalk.yellow(`  ${flavour.envFile}: ${PENDING[flavour.state]}`));
    }
    this.log(
      chalk.dim(
        `\n  In CI, provide the private key as ${SIGNING_KEY_ENV} (base64 PKCS#8, masked).\n`,
      ),
    );
  }
}
