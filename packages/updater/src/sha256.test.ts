import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { Sha256, base64ToBytes } from "./sha256.js";

const text = (value: string) => new TextEncoder().encode(value);

describe("Sha256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
    ],
  ])("matches the FIPS 180-4 vector for %j", (input, expected) => {
    expect(new Sha256().update(text(input)).hex()).toBe(expected);
  });

  it("matches the one-million-a vector fed in uneven chunks", () => {
    const hash = new Sha256();
    const chunk = text("a".repeat(997));
    let remaining = 1_000_000;
    while (remaining > 0) {
      const size = Math.min(remaining, chunk.length);
      hash.update(chunk.subarray(0, size));
      remaining -= size;
    }

    expect(hash.hex()).toBe("cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
  });

  it.each([55, 56, 63, 64, 65, 119, 120, 128])("pads a %i-byte message correctly", (size) => {
    const input = randomBytes(size);
    const expected = createHash("sha256").update(input).digest("hex");

    expect(new Sha256().update(input).hex()).toBe(expected);
  });

  it("gives the same digest however the input is split", () => {
    const input = randomBytes(10_000);
    const expected = createHash("sha256").update(input).digest("hex");

    for (const step of [1, 3, 63, 64, 65, 1000, 4096]) {
      const hash = new Sha256();
      for (let offset = 0; offset < input.length; offset += step) {
        hash.update(input.subarray(offset, offset + step));
      }
      expect(hash.hex(), `step ${step}`).toBe(expected);
    }
  });

  it("refuses to be reused once read", () => {
    const hash = new Sha256();
    hash.hex();

    expect(() => hash.update(text("x"))).toThrow(/already computed/);
    expect(() => hash.digest()).toThrow(/already computed/);
  });
});

describe("base64ToBytes", () => {
  it("round-trips arbitrary bytes", () => {
    const input = randomBytes(1025);

    expect(Buffer.from(base64ToBytes(input.toString("base64")))).toEqual(input);
  });
});
