import { describe, expect, it } from "vite-plus/test";
import { downloadStatus, isExpiredLinkError, isTransientError } from "./check-errors.js";
import { HttpError, NetworkError } from "./http.js";

const http = (status: number) => new HttpError("https://api.test", status, "");

describe("isTransientError", () => {
  it.each([
    ["no answer", new NetworkError("u", false, null)],
    ["a timeout", new NetworkError("u", true, null)],
    ["a 500", http(500)],
    ["a 503", http(503)],
    ["a 408", http(408)],
    ["a 429", http(429)],
    ["a captive portal's HTML", new SyntaxError("Unexpected token <")],
  ])("retries %s", (_label, error) => {
    expect(isTransientError(error)).toBe(true);
  });

  it.each([
    ["a 400", http(400)],
    ["a 401", http(401)],
    ["a 403", http(403)],
    ["a 404", http(404)],
    ["a bug", new TypeError("x is not a function")],
  ])("does not retry %s", (_label, error) => {
    expect(isTransientError(error)).toBe(false);
  });
});

describe("isExpiredLinkError", () => {
  it("reads the file-transfer plugin's error shape", () => {
    expect(downloadStatus({ code: "OS-PLUG-FLTR-0010", data: { httpStatus: 410 } })).toBe(410);
    expect(isExpiredLinkError({ data: { httpStatus: 403 } })).toBe(true);
    expect(isExpiredLinkError({ httpStatus: 401 })).toBe(true);
    expect(isExpiredLinkError(http(410))).toBe(true);
  });

  it("does not treat other failures as an expired link", () => {
    expect(isExpiredLinkError({ data: { httpStatus: 404 } })).toBe(false);
    expect(isExpiredLinkError(new Error("disk full"))).toBe(false);
    expect(isExpiredLinkError(null)).toBe(false);
  });
});
