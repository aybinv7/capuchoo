import type { RecordedStep } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { watchSteps } from "./watch-steps.js";

let steps: RecordedStep[];
let stop: () => void;

function start(options: { maskAllInputs?: boolean; trusted?: (event: Event) => boolean } = {}) {
  steps = [];
  stop = watchSteps((step) => steps.push(step), {
    maskAllInputs: options.maskAllInputs ?? false,
    maskTextSelector: "[data-capuchoo-mask]",
    ignoreSelector: "[data-capuchoo-ignore]",
    trusted: options.trusted ?? (() => true),
  });
}

const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 12.4, clientY: 40.6 }));

function typeInto(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => stop?.());

describe("steps", () => {
  it("records a tap on the control around the touched node, with every way to find it again", () => {
    document.body.innerHTML = `
      <div class="page">
        <button data-testid="save-order" class="button button-fill active"><i class="icon"></i><span>Save order</span></button>
        <button class="button">Cancel</button>
      </div>`;
    start();
    click(document.querySelector("[data-testid=save-order] span")!);
    expect(steps).toHaveLength(1);
    const [step] = steps;
    expect(step).toMatchObject({ action: "tap", x: 12, y: 41 });
    expect(step!.target).toMatchObject({
      tag: "button",
      role: "button",
      name: "Save order",
      text: "Save order",
      testId: { attribute: "data-testid", value: "save-order" },
      css: '[data-testid="save-order"]',
      unique: { testId: true, text: true },
    });
  });

  it("builds a unique CSS path when nothing names the element", () => {
    document.body.innerHTML = `
      <ul class="list"><li><a class="item-link">One</a></li><li><a class="item-link">Two</a></li></ul>`;
    start();
    click(document.querySelectorAll("a")[1]!);
    const css = steps[0]!.target.css;
    expect(document.querySelectorAll(css)).toHaveLength(1);
    expect(document.querySelector(css)!.textContent).toBe("Two");
  });

  it("ignores generated ids and state classes, which change between runs", () => {
    document.body.innerHTML = `<div id="f7-panel-38123"><button id="ember1234" class="active ripple">Go</button><button>Stop</button></div>`;
    start();
    click(document.querySelector("button")!);
    const target = steps[0]!.target;
    expect(target.id).toBeNull();
    expect(target.css).not.toMatch(/ember|f7-panel|active|ripple/);
  });

  it("records the value a field was left with, and Enter after it once", () => {
    document.body.innerHTML = `<label for="q">Customer</label><input id="q" type="search">`;
    start();
    const field = document.querySelector("input")!;
    click(field);
    field.value = "Benali";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    expect(steps.map((step) => step.action)).toEqual(["type", "key"]);
    expect(steps[0]).toMatchObject({ value: "Benali", target: { name: "Customer", id: "q" } });
  });

  it("never records what a masked field holds", () => {
    document.body.innerHTML = `<input type="password" name="pin"><input class="note">`;
    start();
    typeInto(document.querySelector<HTMLInputElement>("[type=password]")!, "1234");
    expect(steps[0]).toMatchObject({ action: "type", value: null, masked: true });

    stop();
    start({ maskAllInputs: true });
    typeInto(document.querySelector<HTMLInputElement>(".note")!, "secret");
    expect(steps[0]).toMatchObject({ value: null, masked: true });
    expect(JSON.stringify(steps)).not.toContain("secret");
  });

  it("does not read text inside a masked region", () => {
    document.body.innerHTML = `<div data-capuchoo-mask><button>Pay 12,000 DA to Karim</button></div>`;
    start();
    click(document.querySelector("button")!);
    expect(steps[0]!.target).toMatchObject({ name: null, text: null });
    expect(JSON.stringify(steps)).not.toContain("Karim");
  });

  it("reports a toggle as its change, not as a tap", () => {
    document.body.innerHTML = `<label><input type="checkbox" name="paid"> Paid</label>`;
    start();
    click(document.querySelector("input")!);
    expect(steps).toEqual([expect.objectContaining({ action: "check", checked: true })]);
  });

  it("skips ignored elements and events the app or a remote control fired", () => {
    document.body.innerHTML = `<button data-capuchoo-ignore>Hidden</button><button>Seen</button>`;
    start({ trusted: (event) => (event as MouseEvent).clientX !== 99 });
    click(document.querySelector("[data-capuchoo-ignore]")!);
    document
      .querySelectorAll("button")[1]!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 99 }));
    expect(steps).toEqual([]);
  });

  it("stops listening when stopped", () => {
    document.body.innerHTML = `<button>Go</button>`;
    start();
    stop();
    click(document.querySelector("button")!);
    expect(steps).toEqual([]);
  });
});
