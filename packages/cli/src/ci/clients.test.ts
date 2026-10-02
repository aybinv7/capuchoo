import { describe, expect, it } from "vite-plus/test";
import { parseClients } from "./clients.js";

describe("parseClients", () => {
  it("maps clients to prod-<client> channels, de-duplicated", () => {
    expect(parseClients(" Acme, globex,acme, prod-initech ,")).toEqual([
      { client: "acme", channel: "prod-acme" },
      { client: "globex", channel: "prod-globex" },
      { client: "initech", channel: "prod-initech" },
    ]);
  });

  it("refuses a name that would break the YAML or a channel", () => {
    expect(() => parseClients("acme corp")).toThrow('"acme corp" is not a usable client name');
    expect(() => parseClients("a:b")).toThrow("not a usable client name");
  });

  it("is empty without --clients", () => {
    expect(parseClients(undefined)).toEqual([]);
  });
});
