import { describe, expect, it } from "vite-plus/test";
import { buildActivity } from "./activity";
import { rewriteCss, rewriteReplayEvent } from "./asset-rewrite";
import { stateAt } from "./db-state";
import { appendToLanes, emptyLanes, lastAtOrBefore } from "./lanes";
import { parseSegment } from "./ndjson";

/** `insert into item values (2,'milk ✓',-0.25,null,'n')` then (3000000000,'big',2,null,null), and an update of id 1. */
const INSERT_B64 = btoa(
  String.fromCharCode(
    ...Uint8Array.from(
      "540501000000006974656d0012000100000000b2d05e0003036269670240000000000000000505120001000000000000000203086d696c6b20e29c9302bfd00000000000000503016e"
        .match(/../g)!
        .map((pair) => Number.parseInt(pair, 16)),
    ),
  ),
);

describe("parseSegment", () => {
  it("skips damaged lines and keeps the rest", () => {
    const text = '{"k":"console","t":1,"d":{}}\nnot json\n{"k":"marker","t":2,"d":{}}\n';
    expect(parseSegment(text).map((event) => event.k)).toEqual(["console", "marker"]);
  });
});

describe("appendToLanes", () => {
  it("routes events to their lanes in time order across appends, and decodes changesets", () => {
    const lanes = emptyLanes();
    appendToLanes(
      lanes,
      [
        {
          k: "network",
          t: 30,
          d: { method: "GET", url: "https://a.test/x", status: 500, duration: 12 },
        },
        { k: "console", t: 10, d: { level: "error", text: "boom" } },
        { k: "replay", t: 5, d: { type: 2, timestamp: 5, data: {} } },
        {
          k: "database",
          t: 20,
          d: {
            db: "main",
            kind: "schema",
            tables: [{ name: "item", columns: [{ name: "id", type: "INTEGER", pk: 1 }] }],
          },
        },
        { k: "database", t: 25, d: { db: "main", kind: "changeset", bytes: { $b64: INSERT_B64 } } },
      ],
      "0",
    );
    appendToLanes(lanes, [{ k: "console", t: 15, d: { level: "warn", text: "late" } }], "1");

    expect(lanes.console.map((entry) => entry.text)).toEqual(["boom", "late"]);
    expect(lanes.replay).toHaveLength(1);
    expect(lanes.schemas.main?.item?.[0]?.name).toBe("id");
    expect(lanes.database[0]!.changes.map((change) => change.new[0])).toEqual([3_000_000_000, 2]);
    expect(lastAtOrBefore(lanes.console, 12)).toBe(0);
    expect(lastAtOrBefore(lanes.console, 9)).toBe(-1);

    const activity = buildActivity(lanes);
    expect(activity.map((item) => [item.lane, item.tone])).toEqual([
      ["console", "danger"],
      ["console", "warning"],
      ["database", "success"],
      ["network", "danger"],
    ]);
  });

  it("keeps an unreadable changeset as an entry with its error", () => {
    const lanes = emptyLanes();
    appendToLanes(
      lanes,
      [{ k: "database", t: 1, d: { db: "main", kind: "changeset", bytes: { $b64: "VA==" } } }],
      "0",
    );
    expect(lanes.database[0]!.error).toBeTruthy();
  });
});

describe("stateAt", () => {
  it("replays changesets up to the playhead", () => {
    const lanes = emptyLanes();
    appendToLanes(
      lanes,
      [{ k: "database", t: 10, d: { db: "main", kind: "changeset", bytes: { $b64: INSERT_B64 } } }],
      "0",
    );
    expect(stateAt(lanes.database, 5, "main").size).toBe(0);
    const rows = stateAt(lanes.database, 10, "main").get("item")!;
    expect([...rows.keys()].sort()).toEqual(["2", "3000000000"]);
    expect(rows.get("2")!.values).toEqual([2, "milk ✓", -0.25, null, "n"]);
  });
});

describe("asset rewriting", () => {
  const assets = new Map([
    ["/assets/index.css", "blob:css"],
    ["/fonts/icons.woff2", "/api/recording-assets/font"],
    ["/img/logo.png", "/api/recording-assets/logo"],
  ]);

  it("points snapshot and mutation URLs at the server's copies", () => {
    const snapshot = {
      type: 2,
      data: {
        node: {
          type: 0,
          childNodes: [
            {
              type: 2,
              tagName: "link",
              attributes: { rel: "stylesheet", href: "https://localhost/assets/index.css" },
            },
            {
              type: 2,
              tagName: "img",
              attributes: { src: "https://localhost/img/logo.png", srcset: "x 2x" },
            },
            { type: 2, tagName: "img", attributes: { src: "https://cdn.test/other.png" } },
          ],
        },
      },
    };
    rewriteReplayEvent(snapshot, assets);
    const children = snapshot.data.node.childNodes;
    expect(children[0]!.attributes.href).toBe("blob:css");
    expect(children[1]!.attributes).toEqual({ src: "/api/recording-assets/logo" });
    expect(children[2]!.attributes.src).toBe("https://cdn.test/other.png");

    const mutation = {
      type: 3,
      data: { source: 0, adds: [], attributes: [{ attributes: { src: "/img/logo.png" } }] },
    };
    rewriteReplayEvent(mutation, assets);
    expect(mutation.data.attributes[0]!.attributes.src).toBe("/api/recording-assets/logo");
  });

  it("resolves a stylesheet's relative url() against where it lived", () => {
    const css =
      '@font-face{src:url("../fonts/icons.woff2")} .a{background:url(data:x)} .b{background:url(missing.png)}';
    expect(rewriteCss(css, "/assets/index.css", assets)).toBe(
      '@font-face{src:url("/api/recording-assets/font")} .a{background:url(data:x)} .b{background:url(missing.png)}',
    );
  });
});
