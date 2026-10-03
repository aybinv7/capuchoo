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

  it("leaves out classes a finger or a page transition added, which a test run never sees", () => {
    document.body.innerHTML = `
      <div class="page page-current"><div class="toolbar">
        <a class="tab-link tab-link-active active-state">One</a><a class="tab-link">Two</a>
      </div></div>
      <div class="page page-previous"><div class="toolbar"><a class="tab-link">Three</a></div></div>`;
    start();
    click(document.querySelector("a")!);
    const css = steps[0]!.target.css;
    expect(css).not.toMatch(/active|current|previous/);
    document.querySelector("a")!.className = "tab-link";
    expect(document.querySelectorAll(css)).toHaveLength(1);
    expect(document.querySelector(css)!.textContent).toBe("One");
  });

  it("keeps the class that says what the element is, over the ones everything shares", () => {
    document.body.innerHTML = `
      <div class="navbar"><a class="link icon-only back"><i class="icon icon-back"></i></a>
      <a class="link icon-only">x</a><a class="link icon-only">y</a></div>`;
    start();
    click(document.querySelector("a.back i")!);
    expect(steps[0]!.target.css).toContain(".back");
    expect(steps[0]!.target.icon).toBe("back");
  });

  it("names a button with no text by the icon it shows", () => {
    document.body.innerHTML = `<a class="link icon-only searchbar-enable"><i class="icon f7-icons">search</i></a>`;
    start();
    click(document.querySelector("a")!);
    expect(steps[0]!.target).toMatchObject({ text: null, name: null, icon: "search" });
  });

  it("reads a label as a person does: icon glyph names left out, pieces spaced", () => {
    document.body.innerHTML = `
      <a class="tab-link"><i class="icon f7-icons">bolt</i><span class="tabbar-label">Reactive</span></a>
      <a class="item-link"><div class="item-title">SO-208978</div><div class="item-after">3,370</div></a>
      <div class="title">Reactive orders</div>`;
    start();
    click(document.querySelector(".tab-link span")!);
    click(document.querySelector(".item-link")!);
    expect(steps[0]!.target).toMatchObject({
      text: "Reactive",
      name: "Reactive",
      unique: { text: true },
    });
    expect(steps[1]!.target).toMatchObject({ text: "SO-208978 3,370", unique: { text: false } });
  });

  it("does not trust a text another element of the same kind contains", () => {
    document.body.innerHTML = `<button>Save</button><button>Save order</button>`;
    start();
    click(document.querySelector("button")!);
    expect(steps[0]!.target.unique.text).toBe(false);
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
