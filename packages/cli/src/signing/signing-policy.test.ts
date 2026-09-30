import { generateReleaseKeyPair } from "@capuchoo/core";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import type { ReleaseKey } from "./release-key.js";
import { describeSigningProblems, type SigningPolicyFacts } from "./signing-policy.js";

let key: ReleaseKey;
let otherPublicKey: string;

beforeAll(async () => {
  const pair = await generateReleaseKeyPair();
  key = { ...pair, fingerprint: "0123456789abcdef", source: "file" };
  otherPublicKey = (await generateReleaseKeyPair()).publicKey;
});

const PROD = { name: "prod", environment: "prod" as const, kind: "release" as const };
const CLIENT = { name: "prod-acme", environment: "prod" as const, kind: "client" as const };
const DEV = { name: "dev", environment: "dev" as const, kind: "release" as const };

function facts(overrides: Partial<SigningPolicyFacts>): SigningPolicyFacts {
  return {
    channel: PROD,
    key,
    requireSignature: false,
    serverPublicKey: undefined,
    flavourPublicKey: undefined,
    flavourFile: "build/prod/.env.prod",
    ...overrides,
  };
}

describe("describeSigningProblems", () => {
  it.each([PROD, CLIENT])(
    "refuses $name when the app requires signatures and no key exists",
    (channel) => {
      const problems = describeSigningProblems(
        facts({ channel, key: null, requireSignature: true }),
      );
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("only accepts signed releases");
      expect(problems[0]).toContain("CAPUCHOO_SIGNING_KEY");
    },
  );

  it("refuses any channel the server would refuse", () => {
    expect(
      describeSigningProblems(facts({ channel: DEV, key: null, requireSignature: true })),
    ).toHaveLength(1);
  });

  it("publishes unsigned when nothing asks for a signature", () => {
    expect(describeSigningProblems(facts({ key: null }))).toEqual([]);
    expect(describeSigningProblems(facts({ key: null, requireSignature: undefined }))).toEqual([]);
  });

  it("refuses an unsigned release to builds that verify signatures", () => {
    const problems = describeSigningProblems(facts({ key: null, flavourPublicKey: key.publicKey }));
    expect(problems[0]).toContain("devices reject unsigned releases");
  });

  it("refuses a key the server does not hold", () => {
    expect(describeSigningProblems(facts({ serverPublicKey: otherPublicKey }))[0]).toContain(
      "not the one the server holds",
    );
  });

  it("refuses a key the flavour does not bake in", () => {
    expect(describeSigningProblems(facts({ flavourPublicKey: otherPublicKey }))[0]).toContain(
      "would reject its own updates",
    );
  });

  it("accepts a matching key in either encoding", () => {
    const pem = `-----BEGIN PUBLIC KEY-----\n${key.publicKey}\n-----END PUBLIC KEY-----\n`;
    expect(
      describeSigningProblems(facts({ serverPublicKey: pem, flavourPublicKey: key.publicKey })),
    ).toEqual([]);
  });
});
