import sodium from "libsodium-wrappers";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { sealSecret } from "./sealed-box";

beforeAll(async () => {
  await sodium.ready;
});

function open(sealed: string, keys: { publicKey: Uint8Array; privateKey: Uint8Array }): string {
  return sodium.to_string(
    sodium.crypto_box_seal_open(base64ToBytes(sealed), keys.publicKey, keys.privateKey),
  );
}

describe("sealSecret", () => {
  it("produces a libsodium sealed box the recipient opens", () => {
    const keys = sodium.crypto_box_keypair();
    const sealed = sealSecret("cpk_live_0123456789", bytesToBase64(keys.publicKey));
    expect(open(sealed, keys)).toBe("cpk_live_0123456789");
  });

  it("round-trips unicode and a keystore-sized payload", () => {
    const keys = sodium.crypto_box_keypair();
    const large = "é∑".repeat(40_000);
    expect(open(sealSecret(large, bytesToBase64(keys.publicKey)), keys)).toBe(large);
  });

  it("uses a fresh ephemeral key each time", () => {
    const keys = sodium.crypto_box_keypair();
    const key = bytesToBase64(keys.publicKey);
    expect(sealSecret("same", key)).not.toBe(sealSecret("same", key));
  });

  it("cannot be opened with another key pair", () => {
    const keys = sodium.crypto_box_keypair();
    const other = sodium.crypto_box_keypair();
    const sealed = sealSecret("secret", bytesToBase64(keys.publicKey));
    expect(() => open(sealed, other)).toThrow(/key pair/);
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(() => sealSecret("x", bytesToBase64(new Uint8Array(16)))).toThrow(/32-byte/);
  });
});
