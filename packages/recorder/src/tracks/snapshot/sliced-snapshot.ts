import { describeNode, registerNode, UNSUPPORTED } from "./serialize.js";
import type { SliceScheduler } from "./slices.js";
import {
  NodeKind,
  type NodeContext,
  type SerializeSettings,
  type SerializedNode,
  type SerializedParent,
  type SnapshotMirror,
} from "./types.js";

export type SnapshotOutcome =
  | { kind: "done"; node: SerializedNode }
  | { kind: "unsupported"; reason: "iframe" | "shadow-root" | "adopted-stylesheets" }
  | { kind: "failed"; error: unknown };

export interface SlicedSnapshotOptions {
  settings: SerializeSettings;
  mirror: SnapshotMirror;
  allocateId: () => number;
  schedule: SliceScheduler;
  now?: () => number;
  /**
   * Slices spent catching up with a page that keeps changing after the first pass, before the rest
   * is finished in a single task. Bounds the time a snapshot can take on a page that never settles.
   */
  maxCatchUpSlices?: number;
}

export interface SnapshotJob {
  /** Something about this node changed without a DOM mutation: a typed value, a scroll position. */
  touch(node: Node | null): void;
  cancel(): void;
}

interface Entry {
  node: Node;
  serialized: SerializedNode;
  context: NodeContext;
  children: NodeContext | null;
  childEntries: Array<Entry | undefined>;
  blocked: boolean;
  masked: boolean;
  generation: number;
  dead: boolean;
}

interface Work {
  node: Node;
  parent: Entry | null;
  generation: number;
  index: number;
  context: NodeContext;
}

/** A page still changing after this many passes is snapshotted the way rrweb does it instead. */
const MAX_AUDITS = 100;

const ROOT_CONTEXT: NodeContext = {
  needsMask: undefined,
  preserveWhiteSpace: true,
  cssCaptured: false,
};

function matching(doc: Document, ...selectors: string[]): Set<Element> {
  const found = new Set<Element>();
  for (const selector of selectors) {
    if (!selector) continue;
    try {
      for (const element of Array.from(doc.querySelectorAll(selector))) found.add(element);
    } catch {
      continue;
    }
  }
  return found;
}

/**
 * A full snapshot of `doc` taken a few milliseconds at a time, equal to the one rrweb takes in one
 * go. Between slices the page keeps changing, so a `MutationObserver` notes what changed, and before
 * the snapshot is handed over everything that changed is written again: the result is the DOM as it
 * stands in the task that delivers it, which is what rrweb's own snapshot promises.
 *
 * - A changed attribute or text is rewritten in place; a changed child list is rebuilt, keeping the
 *   children already written; a removed node is forgotten, and written afresh wherever it reappears.
 * - An element whose block or mask match changed since it was written is written again with its
 *   whole subtree, so masking never lags behind the page.
 * - Ids come from rrweb's mirror, so the snapshot and rrweb's incremental events agree.
 */
export function takeSlicedSnapshot(
  doc: Document,
  options: SlicedSnapshotOptions,
  onDone: (outcome: SnapshotOutcome) => void,
): SnapshotJob {
  const { settings, mirror, allocateId, schedule } = options;
  const now = options.now ?? (() => performance.now());
  const maxCatchUpSlices = options.maxCatchUpSlices ?? 20;

  const entries = new Map<Node, Entry>();
  const stack: Work[] = [];
  const holey = new Set<Entry>();
  const rebuild = new Set<Node>();
  const refresh = new Set<Node>();
  let pending: MutationRecord[] = [];
  let root: Entry | null = null;
  let generation = 0;
  let drained = false;
  let catchUpSlices = 0;
  let audits = 0;
  let finished = false;
  let cancelSlice: (() => void) | null = null;

  const observer = new MutationObserver((batch) => {
    for (const record of batch) pending.push(record);
  });

  function release(): void {
    finished = true;
    observer.disconnect();
    cancelSlice?.();
    cancelSlice = null;
    entries.clear();
    holey.clear();
    rebuild.clear();
    refresh.clear();
    stack.length = 0;
    pending = [];
  }

  function finish(outcome: SnapshotOutcome): void {
    release();
    onDone(outcome);
  }

  function kill(entry: Entry | undefined): void {
    if (!entry || entry.dead) return;
    const doomed: Entry[] = [entry];
    for (let next = doomed.pop(); next; next = doomed.pop()) {
      next.dead = true;
      if (entries.get(next.node) === next) entries.delete(next.node);
      for (const child of next.childEntries) if (child && !child.dead) doomed.push(child);
    }
  }

  function replace(node: Node): void {
    const entry = entries.get(node);
    if (!entry) return;
    kill(entry);
    if (node.parentNode) rebuild.add(node.parentNode);
  }

  function pushChildren(entry: Entry, reuse: boolean): void {
    const context = entry.children;
    if (!context) return;
    const parent = entry.serialized as SerializedParent;
    const previous = reuse ? new Set(entry.childEntries) : null;
    const kids = entry.node.childNodes;
    const count = kids.length;
    entry.generation = ++generation;
    parent.childNodes = Array.from<SerializedNode>({ length: count });
    entry.childEntries = Array.from<Entry | undefined>({ length: count });
    for (let index = count - 1; index >= 0; index--) {
      const kid = kids[index]!;
      const known = previous ? entries.get(kid) : undefined;
      if (known && !known.dead && previous!.has(known)) {
        parent.childNodes[index] = known.serialized;
        entry.childEntries[index] = known;
      } else {
        stack.push({ node: kid, parent: entry, generation: entry.generation, index, context });
      }
    }
  }

  function process(work: Work): void {
    const { parent } = work;
    if (parent && (parent.dead || parent.generation !== work.generation)) return;
    const shallow = describeNode(work.node, work.context, doc, settings, mirror);
    if (shallow === UNSUPPORTED) {
      const reason = (work.node as Element).tagName === "IFRAME" ? "iframe" : "shadow-root";
      finish({ kind: "unsupported", reason });
      return;
    }
    if (
      !shallow ||
      !registerNode(work.node, shallow.node, work.context, settings, mirror, allocateId)
    ) {
      if (parent) holey.add(parent);
      return;
    }
    kill(entries.get(work.node));
    const entry: Entry = {
      node: work.node,
      serialized: shallow.node,
      context: work.context,
      children: shallow.children,
      childEntries: [],
      blocked: shallow.blocked,
      masked: shallow.masked,
      generation: 0,
      dead: false,
    };
    entries.set(work.node, entry);
    if (parent) {
      (parent.serialized as SerializedParent).childNodes[work.index] = shallow.node;
      parent.childEntries[work.index] = entry;
    } else {
      root = entry;
    }
    pushChildren(entry, false);
  }

  function rewrite(node: Node): void {
    const entry = entries.get(node);
    if (!entry || entry.dead) return;
    const shallow = describeNode(node, entry.context, doc, settings, mirror);
    if (
      shallow === UNSUPPORTED ||
      !shallow ||
      shallow.blocked !== entry.blocked ||
      (shallow.children === null) !== (entry.children === null)
    ) {
      replace(node);
      return;
    }
    const { serialized } = entry;
    const fresh = shallow.node;
    if (serialized.type === NodeKind.Element && fresh.type === NodeKind.Element) {
      serialized.attributes = fresh.attributes;
      serialized.isSVG = fresh.isSVG;
      serialized.isCustom = fresh.isCustom;
      if (serialized.tagName === "select") {
        for (const option of Array.from((node as HTMLSelectElement).options)) rewrite(option);
      }
    } else if (
      (serialized.type === NodeKind.Text || serialized.type === NodeKind.Comment) &&
      (fresh.type === NodeKind.Text || fresh.type === NodeKind.Comment)
    ) {
      serialized.textContent = fresh.textContent;
    }
  }

  function regrow(node: Node): void {
    if (!node.isConnected) return;
    const entry = entries.get(node);
    if (!entry || entry.dead) return;
    if (!entry.children) {
      rewrite(node);
      return;
    }
    const inherited = entry.context.needsMask;
    if (inherited === false && node.nodeType === Node.ELEMENT_NODE) {
      const needsMask = node.childNodes.length > 0 && entry.masked;
      if (needsMask !== entry.children.needsMask) {
        replace(node);
        return;
      }
    }
    pushChildren(entry, true);
  }

  function absorb(records: MutationRecord[]): void {
    for (const record of records) {
      const { target } = record;
      if (record.type === "childList") {
        for (const removed of Array.from(record.removedNodes)) kill(entries.get(removed));
        if ((target as Element).tagName === "STYLE") replace(target);
        else rebuild.add(target);
      } else if (record.type === "characterData") {
        const parent = target.parentNode as Element | null;
        if (parent?.tagName === "STYLE") replace(parent);
        else refresh.add(target);
      } else {
        refresh.add(target);
      }
    }
  }

  function settle(): void {
    absorb(pending);
    absorb(observer.takeRecords());
    pending = [];
    for (const node of rebuild) regrow(node);
    rebuild.clear();
    for (const node of refresh) rewrite(node);
    refresh.clear();
    for (const node of rebuild) regrow(node);
    rebuild.clear();
  }

  /** Every element written while the page changed is checked against the selectors as they match now. */
  function audit(): void {
    const blocked = matching(doc, ".rr-block", settings.blockSelector);
    const masked = matching(doc, ".rr-mask", settings.maskTextSelector);
    for (const entry of entries.values()) {
      if (entry.dead || entry.node.nodeType !== Node.ELEMENT_NODE || !entry.node.isConnected) {
        continue;
      }
      const element = entry.node as Element;
      if (blocked.has(element) !== entry.blocked || masked.has(element) !== entry.masked) {
        replace(element);
      }
    }
    for (const node of rebuild) regrow(node);
    rebuild.clear();
  }

  function compact(): void {
    for (const entry of holey) {
      if (entry.dead) continue;
      const parent = entry.serialized as SerializedParent;
      parent.childNodes = parent.childNodes.filter(Boolean);
    }
  }

  /** False when the deadline came first. At least one node is written per call. */
  function walk(deadline: number): boolean {
    while (stack.length > 0) {
      process(stack.pop()!);
      if (finished) return true;
      if (stack.length > 0 && now() >= deadline) return false;
    }
    return true;
  }

  function slice(budgetMs: number): void {
    cancelSlice = null;
    if (finished) return;
    const deadline = catchUpSlices >= maxCatchUpSlices ? Infinity : now() + budgetMs;
    settle();
    for (;;) {
      if (!walk(deadline)) break;
      if (finished) return;
      drained = true;
      settle();
      if (stack.length > 0) continue;
      if (++audits > MAX_AUDITS) {
        finish({ kind: "failed", error: new Error("the page never settled") });
        return;
      }
      audit();
      if (stack.length > 0) continue;
      const top = root as Entry | null;
      if (!top) {
        finish({ kind: "failed", error: new Error("the document was not serialized") });
        return;
      }
      compact();
      finish({ kind: "done", node: top.serialized });
      return;
    }
    if (drained) catchUpSlices++;
    cancelSlice = schedule(guarded);
  }

  function guarded(budgetMs: number): void {
    try {
      slice(budgetMs);
    } catch (error) {
      if (!finished) finish({ kind: "failed", error });
    }
  }

  function refuse(reason: "iframe" | "adopted-stylesheets"): SnapshotJob {
    finished = true;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) onDone({ kind: "unsupported", reason });
    });
    return {
      touch() {},
      cancel() {
        cancelled = true;
      },
    };
  }

  if ((doc.adoptedStyleSheets?.length ?? 0) > 0) return refuse("adopted-stylesheets");
  if (doc.querySelector("iframe")) return refuse("iframe");

  observer.observe(doc, { childList: true, attributes: true, characterData: true, subtree: true });
  stack.push({ node: doc, parent: null, generation: 0, index: 0, context: ROOT_CONTEXT });
  cancelSlice = schedule(guarded);

  return {
    touch(node) {
      if (!finished && node && node !== doc) refresh.add(node);
    },
    cancel() {
      if (!finished) release();
    },
  };
}
