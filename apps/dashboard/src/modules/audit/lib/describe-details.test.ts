import { describe, expect, it } from "vite-plus/test";
import { describeDetails, detailChannel } from "./describe-details";

describe("describeDetails", () => {
  it("lists details except the channel, which has its own column", () => {
    expect(describeDetails({ channel: "prod", from: "1.2.0", to: "1.1.0", reason: null })).toBe(
      "from 1.2.0 · to 1.1.0 · reason none",
    );
    expect(describeDetails({ require_signature: true, nested: { a: 1 } })).toBe(
      'require signature true · nested {"a":1}',
    );
  });

  it("accepts JSON text and plain text", () => {
    expect(describeDetails('{"key":"theme"}')).toBe("key theme");
    expect(describeDetails("not json")).toBe("not json");
    expect(describeDetails(null)).toBe("");
  });

  it("reads the channel name when there is one", () => {
    expect(detailChannel({ channel: "prod-acme" })).toBe("prod-acme");
    expect(detailChannel({ channel: 3 })).toBeNull();
    expect(detailChannel(null)).toBeNull();
  });
});
