import { blake2b } from "@noble/hashes/blake2.js";
import nacl from "tweetnacl";
import { base64ToBytes, bytesToBase64 } from "./base64";

const NONCE_BYTES = 24;

/**
 * libsodium's `crypto_box_seal`, which is how GitHub expects an Actions secret: an ephemeral
 * X25519 key pair, nonce = BLAKE2b-192(ephemeral public key || recipient public key), and the
 * output ephemeral public key || box. Only the repository's private key can open it.
 */
export function sealBytes(message: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  if (recipientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error("The repository public key is not a 32-byte X25519 key.");
  }
  const ephemeral = nacl.box.keyPair();
  const nonceInput = new Uint8Array(ephemeral.publicKey.length + recipientPublicKey.length);
  nonceInput.set(ephemeral.publicKey, 0);
  nonceInput.set(recipientPublicKey, ephemeral.publicKey.length);
  const nonce = blake2b(nonceInput, { dkLen: NONCE_BYTES });
  const box = nacl.box(message, nonce, recipientPublicKey, ephemeral.secretKey);
  ephemeral.secretKey.fill(0);
  const sealed = new Uint8Array(ephemeral.publicKey.length + box.length);
  sealed.set(ephemeral.publicKey, 0);
  sealed.set(box, ephemeral.publicKey.length);
  return sealed;
}

/** Seals a UTF-8 secret for a repository whose public key GitHub gave as base64. */
export function sealSecret(value: string, recipientPublicKeyBase64: string): string {
  const message = new TextEncoder().encode(value);
  try {
    return bytesToBase64(sealBytes(message, base64ToBytes(recipientPublicKeyBase64)));
  } finally {
    message.fill(0);
  }
}
