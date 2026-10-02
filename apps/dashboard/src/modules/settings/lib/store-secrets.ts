import type { GithubWorkflowSecret } from "@capuchoo/core";
import { fetchGithubPublicKey, putGithubSecrets } from "../services/ci-settings.service";

export interface PlainSecret {
  name: GithubWorkflowSecret;
  value: string;
}

/**
 * Seals each value with the repository's public key in the browser and sends only ciphertext.
 * The sealing code is loaded here, on first use, so no other page pays for it.
 */
export async function storeSecrets(appId: string, secrets: readonly PlainSecret[]): Promise<void> {
  const [{ sealSecret }, key] = await Promise.all([
    import("@/shared/lib/sealed-box"),
    fetchGithubPublicKey(appId),
  ]);
  await putGithubSecrets(
    appId,
    secrets.map((secret) => ({
      name: secret.name,
      key_id: key.key_id,
      encrypted_value: sealSecret(secret.value, key.key),
    })),
  );
}
