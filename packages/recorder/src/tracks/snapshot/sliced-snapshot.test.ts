import { beforeEach, describe, expect, it } from "vite-plus/test";
import { takeSlicedSnapshot, type SnapshotOutcome } from "./sliced-snapshot.js";
import { createTestMirror, flushMutations, manualSlices, steppingClock } from "./testing.js";
import type { SerializeSettings, SerializedNode, SnapshotMirror } from "./types.js";

const settings: SerializeSettings = {
  maskTextSelector: "[data-capuchoo-mask]",
  blockSelector: "[data-capuchoo-block]",
  maskInputOptions: { password: true },
  slimDOM: {
    script: true,
    comment: true,
    headFavicon: true,
    headWhitespace: true,
    headMetaDescKeywords: true,
    headMetaSocial: true,
    headMetaRobots: true,
    headMetaHttpEquiv: true,
    headMetaAuthorship: true,
    headMetaVerification: true,
  },
};

let nextId = 1;

function start(
  mirror: SnapshotMirror = createTestMirror(),
  options: { maxCatchUpSlices?: number } = {},
) {
  const slices = manualSlices();
  let outcome: SnapshotOutcome | null = null;
  const job = takeSlicedSnapshot(
    document,
    {
      settings,
      mirror,
      allocateId: () => nextId++,
      schedule: slices.schedule,
      now: steppingClock(),
      ...options,
    },
    (result) => {
      outcome = result;
    },
  );
  return { slices, job, mirror, result: () => outcome as SnapshotOutcome | null };
}

function done(outcome: SnapshotOutcome | null): SerializedNode {
  expect(outcome?.kind).toBe("done");
  return (outcome as { node: SerializedNode }).node;
}

/** The same document in one uninterrupted pass, on the same mirror: what rrweb would have taken. */
function atomic(mirror: SnapshotMirror): SerializedNode {
  const run = start(mirror);
  run.slices.runAll(Infinity);
  return done(run.result());
}

function byId(node: SerializedNode, id: number): SerializedNode | undefined {
  if (node.id === id) return node;
  if (node.type !== 0 && node.type !== 2) return undefined;
  for (const child of node.childNodes) {
    const found = byId(child, id);
    if (found) return found;
  }
  return undefined;
}

function serializedOf(root: SerializedNode, mirror: SnapshotMirror, node: Node) {
  return byId(root, mirror.getId(node)) as
    | (SerializedNode & { attributes?: Record<string, unknown>; textContent?: string })
    | undefined;
}

function ids(node: SerializedNode, into: number[] = []): number[] {
  into.push(node.id);
  if (node.type === 0 || node.type === 2) for (const child of node.childNodes) ids(child, into);
  return into;
}

function list(rows: number): HTMLUListElement {
  const ul = document.createElement("ul");
  ul.id = "list";
  for (let index = 1; index <= rows; index++) {
    const li = document.createElement("li");
    li.textContent = `Row ${index}`;
    ul.append(li);
  }
  return ul;
}

beforeEach(() => {
  nextId = 1;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("takeSlicedSnapshot", () => {
  it("writes the page the way rrweb does: masked text, blocked boxes, masked passwords, slim head", () => {
    document.head.innerHTML = `<meta name="description" content="shop"><script>1</script><style>.a{color:red}</style><title>Orders</title>`;
    document.body.innerHTML = `
      <div class="page"><!-- note -->
        <p id="secret" data-capuchoo-mask>Secret 12</p>
        <div id="blocked" data-capuchoo-block><span>hidden</span></div>
        <input id="password" type="password" value="hunter2">
        <input id="name" value="Ada">
        <svg><circle r="1"></circle></svg>
      </div>`;
    const run = start();
    run.slices.runAll();
    const root = done(run.result());
    const at = (selector: string) =>
      serializedOf(root, run.mirror, document.querySelector(selector)!);

    expect(
      serializedOf(root, run.mirror, document.getElementById("secret")!.firstChild!),
    ).toMatchObject({ textContent: "****** **" });
    expect(at("#blocked")).toMatchObject({
      attributes: { rr_width: "0px", rr_height: "0px" },
      childNodes: [],
    });
    expect(at("#password")?.attributes?.value).toBe("*******");
    expect(at("#name")?.attributes?.value).toBe("Ada");
    expect(at("circle")).toMatchObject({ isSVG: true });
    expect(String(at("style")?.attributes?._cssText)).toContain("color: red");
    expect(run.mirror.getId(document.querySelector("script")!)).toBe(-2);
    expect(run.mirror.getId(document.querySelector("meta")!)).toBe(-2);
    const all = ids(root);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(-2);
  });

  it("is written a few nodes per slice, never in the task that asked for it", () => {
    document.body.append(list(30));
    const run = start();
    expect(run.result()).toBeNull();
    expect(run.mirror.hasNode(document.body)).toBe(false);
    expect(run.slices.pending).toBe(1);
    const slices = run.slices.runAll(3);
    expect(slices).toBeGreaterThan(10);
    done(run.result());
  });

  it("keeps every change the page made between slices", async () => {
    const ul = list(40);
    const name = document.createElement("input");
    name.value = "Ada";
    document.body.append(name, ul);
    const rows = Array.from(ul.children) as HTMLElement[];
    const run = start();
    while (!run.mirror.hasNode(rows[6]!.firstChild!)) run.slices.runOne(4);
    expect(run.result()).toBeNull();

    rows[0]!.firstChild!.textContent = "Row 1, edited";
    rows[1]!.remove();
    ul.append(rows[2]!);
    rows[3]!.className = "selected";
    rows[4]!.setAttribute("data-capuchoo-mask", "");
    for (let index = 41; index <= 45; index++) {
      const li = document.createElement("li");
      li.textContent = `Row ${index}`;
      ul.append(li);
    }
    name.value = "Grace";
    run.job.touch(name);
    await flushMutations();
    run.slices.runAll(4);
    const sliced = done(run.result());

    expect(sliced).toEqual(atomic(run.mirror));
    expect(serializedOf(sliced, run.mirror, rows[4]!.firstChild!)?.textContent).toBe("*** *");
    expect(serializedOf(sliced, run.mirror, name)?.attributes?.value).toBe("Grace");
    expect(serializedOf(sliced, run.mirror, rows[1]!)).toBeUndefined();
    const listed = serializedOf(sliced, run.mirror, ul) as { childNodes: SerializedNode[] };
    expect(listed.childNodes.at(-1)?.id).toBe(run.mirror.getId(ul.lastElementChild!));
    expect(listed.childNodes).toHaveLength(44);
  });

  it("masks text the moment its element starts to match the mask selector", async () => {
    document.body.innerHTML = `<section><p id="card">4111 1111</p></section><div id="tail"></div>`;
    const card = document.getElementById("card")!;
    const run = start();
    while (!run.mirror.hasNode(card.firstChild!)) run.slices.runOne(1);
    document.querySelector("section")!.setAttribute("data-capuchoo-mask", "");
    await flushMutations();
    run.slices.runAll(1);
    const root = done(run.result());
    expect(serializedOf(root, run.mirror, card.firstChild!)?.textContent).toBe("**** ****");
  });

  it("finishes on a page that never stops changing", async () => {
    document.body.append(list(60));
    const clock = document.createElement("time");
    clock.textContent = "0";
    document.body.append(clock);
    const run = start(createTestMirror(), { maxCatchUpSlices: 3 });
    const text = clock.firstChild as Text;
    let tick = 0;
    for (;;) {
      run.slices.runOne(2);
      if (run.result() !== null || tick > 500) break;
      text.data = String(++tick);
      document.body.append(document.createElement("i"));
      await flushMutations();
    }
    const root = done(run.result());
    expect(tick).toBeLessThan(500);
    expect(serializedOf(root, run.mirror, text)?.textContent).toBe(String(tick));
    expect(root).toEqual(atomic(run.mirror));
  });

  it("hands an iframe or a shadow root back to rrweb", async () => {
    document.body.innerHTML = `<iframe></iframe>`;
    const framed = start();
    await Promise.resolve();
    expect(framed.result()).toEqual({ kind: "unsupported", reason: "iframe" });
    expect(framed.slices.pending).toBe(0);

    document.body.innerHTML = `<div id="host"></div>`;
    document.getElementById("host")!.attachShadow({ mode: "open" });
    const shadowed = start();
    shadowed.slices.runAll();
    expect(shadowed.result()).toEqual({ kind: "unsupported", reason: "shadow-root" });
  });

  it("does nothing more once cancelled", async () => {
    document.body.append(list(20));
    const run = start();
    run.slices.runOne(2);
    run.job.cancel();
    document.body.append(document.createElement("p"));
    await flushMutations();
    expect(run.slices.pending).toBe(0);
    expect(run.result()).toBeNull();
  });
});
