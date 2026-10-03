import type { RecordedStep, StepTarget } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { emptyLanes } from "../lanes";
import { stepLabel } from "../steps";
import type { Lanes, NetworkLaneEntry } from "../../types/recordings.types";
import { toCapubridge } from "./capubridge";
import { toChromeRecorder } from "./chrome-recorder";
import { toCypress } from "./cypress";
import { buildExportPlan, type ExportPlan } from "./plan";
import { toPlaywright } from "./playwright";
import type { ExportOptions } from "./types";

function target(overrides: Partial<StepTarget> = {}): StepTarget {
  return {
    tag: "button",
    role: "button",
    name: null,
    text: null,
    testId: null,
    id: null,
    css: "div.page > button:nth-of-type(2)",
    unique: { testId: false, id: false, text: false },
    inputType: null,
    ...overrides,
  };
}

const save = target({
  name: "Save order",
  text: "Save order",
  testId: { attribute: "data-testid", value: "save-order" },
  unique: { testId: true, id: false, text: true },
});
const customer = target({
  tag: "input",
  role: "searchbox",
  name: "Customer",
  id: "q",
  unique: { testId: false, id: true, text: false },
  inputType: "search",
  css: "#q",
});
const pin = target({
  tag: "input",
  role: "textbox",
  name: "PIN code",
  css: "form > input",
  inputType: "password",
});
const cancel = target({
  name: "Cancel",
  text: "Cancel",
  unique: { testId: false, id: false, text: true },
});

function lanesWith(
  steps: Array<[number, RecordedStep]>,
  routes: Array<[number, string]>,
  network: NetworkLaneEntry[] = [],
): Lanes {
  const lanes = emptyLanes();
  lanes.steps = steps.map(([t, step], index) => ({
    id: `s${index}`,
    t,
    step,
    label: stepLabel(step),
  }));
  lanes.markers = routes.map(([t, url], index) => ({
    id: `r${index}`,
    t,
    kind: "route",
    label: url,
    data: { kind: "route", url },
  }));
  lanes.network = network;
  return lanes;
}

const response = (t: number, url: string, body: string | null): NetworkLaneEntry => ({
  id: `n${t}`,
  t,
  transport: "fetch",
  method: "get",
  url,
  status: 200,
  duration: 40,
  error: null,
  traceId: null,
  requestHeaders: {},
  responseHeaders: { "Content-Type": "application/json" },
  requestBody: null,
  responseBody: body,
  responseSize: null,
});

const lanes = lanesWith(
  [
    [1100, { kind: "step", action: "type", target: customer, value: "Benali" }],
    [1200, { kind: "step", action: "key", target: customer, key: "Enter" }],
    [1500, { kind: "step", action: "type", target: pin, value: null, masked: true }],
    [2000, { kind: "step", action: "tap", target: save, x: 40, y: 600, offsetX: 12, offsetY: 8 }],
    [9000, { kind: "step", action: "tap", target: cancel }],
  ],
  [
    [1000, "/#/orders"],
    [2400, "/#/orders/42"],
    [20_000, "/#/settings"],
  ],
  [
    response(1300, "https://api.example.com/customers?q=Benali", '[{"id":1}]'),
    response(1350, "https://api.example.com/ping", null),
  ],
);

function plan(from = 0, to = 10_000, stubs = true): ExportPlan {
  return buildExportPlan({
    lanes,
    from,
    to,
    title: "Xiaomi · 1.0",
    viewport: { width: 393, height: 852, dpr: 2.75 },
    platform: "android",
    stubs,
  });
}

const options: ExportOptions = {
  complete: true,
  baseUrl: "http://localhost:5173/",
  appPackage: "com.ayb.testbed",
};

describe("export plan", () => {
  it("opens where the app was, replays each step and checks where a step led", () => {
    expect(plan().steps.map((step) => step.kind)).toEqual([
      "visit",
      "type",
      "key",
      "type",
      "tap",
      "url",
      "tap",
    ]);
    expect(plan().steps[0]).toMatchObject({ kind: "visit", url: "/#/orders" });
    expect(plan().steps[5]).toMatchObject({ kind: "url", url: "/#/orders/42" });
  });

  it("does not assert a route that no step led to", () => {
    expect(plan(0, 30_000).steps.filter((step) => step.kind === "url")).toHaveLength(1);
  });

  it("keeps to the chosen stretch and starts at the route in force there", () => {
    const later = plan(1800, 10_000);
    expect(later.steps[0]).toMatchObject({ kind: "visit", url: "/#/orders" });
    expect(later.steps.filter((step) => step.kind === "type")).toEqual([]);
  });

  it("turns a masked value into a variable and never carries it", () => {
    const masked = plan().steps.find((step) => step.kind === "type" && step.variable);
    expect(masked).toMatchObject({ variable: "PIN_CODE", value: "" });
    expect(plan().variables).toEqual(["PIN_CODE"]);
  });

  it("keeps recorded responses with a body, once each, only when asked", () => {
    expect(plan().stubs).toEqual([
      expect.objectContaining({
        method: "GET",
        url: "https://api.example.com/customers?q=Benali",
        contentType: "application/json",
      }),
    ]);
    expect(plan(0, 10_000, false).stubs).toEqual([]);
  });
});

describe("Cypress", () => {
  const code = toCypress(plan(), options).code;

  it("writes a spec that finds each element the surest way", () => {
    expect(code).toContain("cy.viewport(393, 852);");
    expect(code).toContain('cy.visit("http://localhost:5173/#/orders");');
    expect(code).toContain('cy.get("#q").clear().type("Benali");');
    expect(code).toContain('cy.get("#q").type("{enter}");');
    expect(code).toContain('cy.get("[data-testid=\\"save-order\\"]").click();');
    expect(code).toContain('cy.contains("button", /^\\s*Cancel\\s*$/).click();');
    expect(code).toContain('cy.url().should("include", "/#/orders/42");');
    expect(code).toMatch(/^describe\("Xiaomi · 1\.0", \(\) => \{/);
  });

  it("reads a masked value from the environment and keeps it out of the log", () => {
    expect(code).toContain('.type(Cypress.env("PIN_CODE"), { log: false });');
  });

  it("answers with the recorded response", () => {
    expect(code).toContain(
      'cy.intercept("GET", "https://api.example.com/customers?q=Benali", { statusCode: 200, body: "[{\\"id\\":1}]", headers: { "content-type": "application/json" } });',
    );
  });

  it("can give only the commands", () => {
    const bare = toCypress(plan(), { ...options, complete: false }).code;
    expect(bare).not.toContain("describe(");
    expect(bare.startsWith("cy.viewport")).toBe(true);
  });

  it("types a brace as a brace", () => {
    const braces = lanesWith(
      [[1, { kind: "step", action: "type", target: customer, value: "a{b}" }]],
      [],
    );
    const out = toCypress(
      buildExportPlan({
        lanes: braces,
        from: 0,
        to: 10,
        title: "t",
        viewport: null,
        platform: "web",
        stubs: false,
      }),
      options,
    ).code;
    expect(out).toContain('.type("a{{}b}")');
  });
});

describe("Playwright", () => {
  const code = toPlaywright(plan(), options).code;

  it("writes a test for a touch phone with Playwright's own locators", () => {
    expect(code).toContain('import { test } from "@playwright/test";');
    expect(code).toContain(
      "test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });",
    );
    expect(code).toContain('await page.getByTestId("save-order").click();');
    expect(code).toContain(
      'await page.getByRole("button", { name: "Cancel", exact: true }).click();',
    );
    expect(code).toContain('await page.locator("#q").fill("Benali");');
    expect(code).toContain('await page.locator("#q").press("Enter");');
    expect(code).toContain(
      'await page.locator("form > input").fill(process.env["PIN_CODE"] ?? "");',
    );
    expect(code).toContain('await page.waitForURL((url) => url.href.includes("/#/orders/42"));');
  });

  it("answers only the recorded method with the recorded response", () => {
    expect(code).toContain('route.request().method() === "GET"');
    expect(code).toContain("route.fallback()");
  });
});

describe("Chrome Recorder", () => {
  const document = JSON.parse(toChromeRecorder(plan(), options).code);

  it("writes the JSON Chrome DevTools imports", () => {
    expect(document.title).toBe("Xiaomi · 1.0");
    expect(document.steps[0]).toMatchObject({
      type: "setViewport",
      width: 393,
      isMobile: true,
      isLandscape: false,
    });
    expect(document.steps[1]).toMatchObject({
      type: "navigate",
      url: "http://localhost:5173/#/orders",
    });
    const click = document.steps.find((step: { type: string }) => step.type === "click");
    expect(click).toMatchObject({ offsetX: 12, offsetY: 8 });
    expect(click.selectors).toEqual([
      ['[data-testid="save-order"]'],
      ["aria/Save order"],
      ["div.page > button:nth-of-type(2)"],
      ["text/Save order"],
    ]);
    expect(
      document.steps.filter((step: { type: string }) => step.type.startsWith("key")),
    ).toHaveLength(2);
  });

  it("says what the format cannot carry", () => {
    const { warnings } = toChromeRecorder(plan(), options);
    expect(warnings.join(" ")).toMatch(/PIN_CODE.*left empty/);
    expect(warnings.join(" ")).toMatch(/real API/);
  });
});

describe("Capubridge", () => {
  const result = toCapubridge(plan(), options, () => "flow-1");
  const flow = JSON.parse(result.code);

  it("writes a flow Capubridge accepts: version 1, unique step ids, known ops", () => {
    expect(flow).toMatchObject({
      version: 1,
      id: "flow-1",
      name: "Xiaomi · 1.0",
      appPackage: "com.ayb.testbed",
    });
    const ids = flow.steps.map((step: { id: string }) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(flow.steps.map((step: { op: string }) => step.op)).toEqual([
      "openApp",
      "type",
      "pressKey",
      "type",
      "tap",
      "assert",
      "tap",
    ]);
    expect(flow.steps[4]).toMatchObject({
      target: { kind: "selector", cssSelector: '[data-testid="save-order"]' },
    });
    expect(flow.steps[2]).toMatchObject({ keycode: "KEYCODE_ENTER" });
    expect(flow.steps[5].assertion).toEqual({ kind: "urlMatches", pattern: "/#/orders/42" });
  });

  it("says what the phone cannot do instead of failing quietly", () => {
    expect(result.warnings.join(" ")).toMatch(/starts at \/#\/orders/);
    expect(result.warnings.join(" ")).toMatch(/PIN_CODE/);
    expect(toCapubridge(plan(), { ...options, appPackage: "" }).warnings.join(" ")).toMatch(
      /package/,
    );
  });

  it("escapes a route for the regular expression it is checked with", () => {
    const routes = lanesWith(
      [[1, { kind: "step", action: "tap", target: save }]],
      [
        [0, "/"],
        [2, "/orders?id=4+2"],
      ],
    );
    const flow2 = JSON.parse(
      toCapubridge(
        buildExportPlan({
          lanes: routes,
          from: 0,
          to: 10,
          title: "t",
          viewport: null,
          platform: "android",
          stubs: false,
        }),
        options,
        () => "x",
      ).code,
    );
    expect(flow2.steps.at(-1).assertion.pattern).toBe("/orders\\?id=4\\+2");
  });
});
