import type { PointerVerdict } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { bundle, catalog, channel, native } from "../../testing/fixtures";
import {
  acceptedCandidates,
  channelsServing,
  deliveryCandidates,
  previewPointer,
  servedByBaseIds,
} from "./eligibility";

/** The refusal reason of a verdict, or null when it was accepted. */
const refusal = (verdict: PointerVerdict) => (verdict.ok ? null : verdict.reason);

const v1 = bundle({ id: "b-1", version_name: "1.0.0" });
const v2 = bundle({ id: "b-2", version_name: "1.1.0" });
const v3 = bundle({ id: "b-3", version_name: "1.2.0" });
const staging = bundle({ id: "b-s", version_name: "1.3.0", flavour: "staging" });

describe("previewPointer", () => {
  it("accepts a forward move and reports what it replaces", () => {
    const prod = channel({ current_bundle_id: "b-2" });
    const preview = previewPointer({
      channel: prod,
      artefact: v3,
      catalog: catalog({ bundles: [v1, v2, v3], channels: [prod] }),
    });
    expect(preview.verdict).toEqual({ ok: true, direction: "forward" });
    expect(preview.from?.id).toBe("b-2");
    expect(preview.to.id).toBe("b-3");
  });

  it("refuses a lower version unless the move is a rollback", () => {
    const prod = channel({ current_bundle_id: "b-2" });
    const facts = { channel: prod, artefact: v1, catalog: catalog({ bundles: [v1, v2] }) };
    const forward = previewPointer(facts);
    expect(forward.verdict.ok).toBe(false);
    expect(refusal(forward.verdict)).toBe("downgrade-needs-rollback");
    expect(previewPointer({ ...facts, rollback: true }).verdict).toEqual({
      ok: true,
      direction: "downgrade",
    });
  });

  it("refuses a rollback that is not lower", () => {
    const prod = channel({ current_bundle_id: "b-2" });
    const preview = previewPointer({
      channel: prod,
      artefact: v3,
      catalog: catalog({ bundles: [v2, v3] }),
      rollback: true,
    });
    expect(preview.verdict.ok).toBe(false);
    expect(refusal(preview.verdict)).toBe("rollback-not-lower");
  });

  it("refuses an artefact built from another flavour", () => {
    const preview = previewPointer({
      channel: channel(),
      artefact: staging,
      catalog: catalog({ bundles: [staging] }),
    });
    expect(preview.verdict.ok).toBe(false);
    expect(refusal(preview.verdict)).toBe("flavour-mismatch");
  });

  it("refuses a platform the channel does not serve", () => {
    const preview = previewPointer({
      channel: channel({ android_enabled: false }),
      artefact: v1,
      catalog: catalog({ bundles: [v1] }),
    });
    expect(preview.verdict.ok).toBe(false);
    expect(refusal(preview.verdict)).toBe("platform-disabled");
  });

  it("gates a bundle on the channel's native build", () => {
    const gated = bundle({ id: "b-g", version_name: "2.0.0", min_native_version: 20 });
    const old = native({ id: "n-10", version_code: 10 });
    const prod = channel({ current_native_id: "n-10" });
    const preview = previewPointer({
      channel: prod,
      artefact: gated,
      catalog: catalog({ bundles: [gated], natives: [old] }),
    });
    expect(preview.verdict.ok).toBe(false);
    expect(refusal(preview.verdict)).toBe("native-gate");
  });

  it("compares native builds by build number", () => {
    const n10 = native({ id: "n-10", version_code: 10, version_name: "1.0.0" });
    const n12 = native({ id: "n-12", version_code: 12, version_name: "1.0.0" });
    const prod = channel({ current_native_id: "n-10" });
    expect(
      previewPointer({ channel: prod, artefact: n12, catalog: catalog({ natives: [n10, n12] }) })
        .verdict,
    ).toEqual({
      ok: true,
      direction: "forward",
    });
  });

  it("lets a client channel point only at what its base has served", () => {
    const base = channel({ id: "ch-prod", current_bundle_id: "b-2" });
    const client = channel({
      id: "ch-acme",
      name: "prod-acme",
      kind: "client",
      base_channel_id: "ch-prod",
    });
    const facts = {
      channel: client,
      catalog: catalog({ bundles: [v1, v2, v3], channels: [base, client] }),
    };
    const served = servedByBaseIds(base, [
      {
        id: "1",
        action: "point_bundle",
        from_id: null,
        to_id: "b-1",
        from_version: null,
        to_version: "1.0.0",
        reason: null,
        created_at: "2026-09-01T00:00:00.000Z",
        actor_api_key_id: null,
        actor_email: null,
      },
    ]);
    expect([...served].sort()).toEqual(["b-1", "b-2"]);
    expect(previewPointer({ ...facts, artefact: v2, servedByBase: served }).verdict.ok).toBe(true);
    const never = previewPointer({ ...facts, artefact: v3, servedByBase: served });
    expect(never.verdict.ok).toBe(false);
    expect(refusal(never.verdict)).toBe("not-on-base");
    expect(previewPointer({ ...facts, artefact: v2 }).verdict.ok).toBe(false);
  });
});

describe("candidates", () => {
  it("lists every other artefact of the kind, newest first, with its verdict", () => {
    const prod = channel({ current_bundle_id: "b-2" });
    const all = deliveryCandidates(prod, catalog({ bundles: [v1, v3, v2, staging] }), "ota");
    expect(all.map((candidate) => candidate.artefact.id)).toEqual(["b-s", "b-3", "b-1"]);
    expect(acceptedCandidates(all).map((candidate) => candidate.artefact.id)).toEqual(["b-3"]);
  });

  it("offers only lower versions for a rollback", () => {
    const prod = channel({ current_bundle_id: "b-3" });
    const rollback = acceptedCandidates(
      deliveryCandidates(prod, catalog({ bundles: [v1, v2, v3] }), "ota", { rollback: true }),
    );
    expect(rollback.map((candidate) => candidate.artefact.version_name)).toEqual([
      "1.1.0",
      "1.0.0",
    ]);
  });

  it("finds the channels serving an artefact", () => {
    const channels = [
      channel({ id: "a", current_bundle_id: "b-1" }),
      channel({ id: "b", current_native_id: "b-1" }),
      channel({ id: "c" }),
    ];
    expect(channelsServing("b-1", channels).map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});
