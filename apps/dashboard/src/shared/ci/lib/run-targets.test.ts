import { describe, expect, it } from "vite-plus/test";
import { bundle, catalog, channel } from "../../testing/fixtures";
import { clientChannels, releaseChannelGroups, suggestedDeliverVersion } from "./run-targets";

const channels = [
  channel({ id: "p", name: "prod", environment: "prod", current_bundle_id: "b-2" }),
  channel({ id: "d", name: "dev", environment: "dev" }),
  channel({ id: "s2", name: "staging-eu", environment: "staging" }),
  channel({ id: "s1", name: "staging", environment: "staging" }),
  channel({ id: "c", name: "prod-acme", kind: "client", base_channel_id: "p" }),
];

describe("releaseChannelGroups", () => {
  it("groups release channels in promotion order and leaves clients out", () => {
    expect(
      releaseChannelGroups(channels).map((group) => [
        group.environment,
        group.channels.map((entry) => entry.name),
      ]),
    ).toEqual([
      ["dev", ["dev"]],
      ["staging", ["staging", "staging-eu"]],
      ["prod", ["prod"]],
    ]);
    expect(clientChannels(channels).map((entry) => entry.name)).toEqual(["prod-acme"]);
  });
});

describe("suggestedDeliverVersion", () => {
  const value = catalog({ channels, bundles: [bundle({ id: "b-2", version_name: "1.4.2" })] });

  it("offers what the client's base serves, by channel or client name", () => {
    expect(suggestedDeliverVersion(value, "prod-acme")).toBe("1.4.2");
    expect(suggestedDeliverVersion(value, "acme")).toBe("1.4.2");
  });

  it("offers nothing when it cannot tell", () => {
    expect(suggestedDeliverVersion(value, "")).toBeNull();
    expect(suggestedDeliverVersion(value, "globex")).toBeNull();
    expect(suggestedDeliverVersion(catalog({ channels }), "acme")).toBeNull();
  });
});
