import { describe, expect, it } from "vite-plus/test";
import {
  INIT_STEPS,
  isComplete,
  isInitStep,
  pendingSteps,
  planInit,
  selectSteps,
  type InitFacts,
} from "./init-plan.js";

/** A fully wired app with a bundle in flight. */
const done: InitFacts = {
  signedIn: true,
  linked: true,
  identifierRegistered: true,
  channelCount: 3,
  packagesInstalled: true,
  flavoursMissingEnv: 0,
  codeWired: true,
  servingBundle: true,
  deviceConfirmed: true,
};

/** Nothing done - a directory that has never seen this CLI. */
const fresh: InitFacts = {
  signedIn: false,
  linked: false,
  identifierRegistered: false,
  channelCount: 0,
  packagesInstalled: false,
  flavoursMissingEnv: 3,
  codeWired: false,
  servingBundle: false,
  deviceConfirmed: false,
};

const idsOf = (facts: InitFacts, prove = false) => planInit(facts, { prove }).map((s) => s.id);
const statusOf = (facts: InitFacts, id: string, prove = false) =>
  planInit(facts, { prove }).find((s) => s.id === id)?.status;

describe("planInit", () => {
  it("orders the steps by dependency", () => {
    const ids = idsOf(fresh);

    expect(ids.indexOf("credentials")).toBeLessThan(ids.indexOf("link"));
    expect(ids.indexOf("link")).toBeLessThan(ids.indexOf("identifiers"));
    expect(ids.indexOf("link")).toBeLessThan(ids.indexOf("channels"));
    expect(ids.indexOf("packages")).toBeLessThan(ids.indexOf("code"));
    expect(ids.indexOf("env")).toBeLessThan(ids.indexOf("verify"));
  });

  it("leaves publish and confirm out unless asked", () => {
    expect(idsOf(fresh)).not.toContain("publish");
    expect(idsOf(fresh)).not.toContain("confirm");
    expect(idsOf(fresh, true)).toContain("publish");
    expect(idsOf(fresh, true)).toContain("confirm");
  });

  it("marks everything todo on a fresh directory, bar what it cannot know", () => {
    // identifiers and channels are properties of an app that does not exist
    // yet, so they are "unknown" until link has run - see below.
    const unknowable = new Set(["identifiers", "channels"]);

    // Compared as a whole rather than step by step, so a failure names which
    // step disagreed instead of just reporting a wrong string.
    expect(planInit(fresh, { prove: true }).map((step) => [step.id, step.status])).toEqual(
      INIT_STEPS.map((id) => [id, unknowable.has(id) ? "unknown" : "todo"]),
    );
  });

  /**
   * The property that makes one command safe to run whenever you are unsure:
   * a second run does nothing but check.
   */
  it("is a no-op on a finished app, except for verify", () => {
    const plan = planInit(done, { prove: true });

    expect(pendingSteps(plan).map((s) => s.id)).toEqual(["verify"]);
    expect(isComplete(plan)).toBe(true);
  });

  it("always runs verify, because a cached pass is a claim and not a check", () => {
    expect(statusOf(done, "verify")).toBe("todo");
    expect(statusOf(fresh, "verify")).toBe("todo");
  });

  it("cannot know about identifiers or channels before the app is linked", () => {
    // Reporting "todo" for something unknowable reads as a problem the operator
    // has to act on.
    expect(statusOf({ ...fresh, signedIn: true }, "identifiers")).toBe("unknown");
    expect(statusOf({ ...fresh, signedIn: true }, "channels")).toBe("unknown");

    expect(statusOf({ ...done, identifierRegistered: false }, "identifiers")).toBe("todo");
  });

  it("counts the flavours still missing their variables", () => {
    const plan = planInit({ ...done, flavoursMissingEnv: 2 });
    const env = plan.find((s) => s.id === "env")!;

    expect(env.status).toBe("todo");
    expect(env.why).toContain("2 flavours");
  });

  it("uses the singular for one flavour and one channel", () => {
    expect(planInit({ ...done, flavoursMissingEnv: 1 }).find((s) => s.id === "env")!.why).toContain(
      "1 flavour would",
    );
    expect(planInit({ ...done, channelCount: 1 }).find((s) => s.id === "channels")!.why).toContain(
      "1 channel",
    );
  });

  it("explains why each pending step matters, not just that it is pending", () => {
    const terse = pendingSteps(planInit(fresh, { prove: true }))
      .filter((step) => step.why.length <= 10)
      .map((step) => step.id);

    expect(terse).toEqual([]);
  });

  it("plans every declared step and nothing else", () => {
    expect(idsOf(fresh, true).sort()).toEqual([...INIT_STEPS].sort());
  });
});

describe("selectSteps", () => {
  const plan = planInit(fresh, { prove: true });

  it("keeps everything by default", () => {
    expect(selectSteps(plan, {}).length).toBe(plan.length);
  });

  it("drops what --skip names", () => {
    const ids = selectSteps(plan, { skip: ["packages", "code"] }).map((s) => s.id);

    expect(ids).not.toContain("packages");
    expect(ids).not.toContain("code");
    expect(ids).toContain("env");
  });

  it("keeps only what --only names, plus verify", () => {
    const ids = selectSteps(plan, { only: ["env"] }).map((s) => s.id);

    // A step that changed something and then reported nothing about it is worse
    // than a slightly slower run.
    expect(ids).toEqual(["env", "verify"]);
  });

  it("lets --skip override --only for verify", () => {
    expect(selectSteps(plan, { only: ["env"], skip: ["verify"] }).map((s) => s.id)).toEqual([
      "env",
    ]);
  });

  it("ignores an empty --only", () => {
    expect(selectSteps(plan, { only: [] }).length).toBe(plan.length);
  });
});

describe("isInitStep", () => {
  it("accepts a declared step and rejects anything else", () => {
    expect(isInitStep("env")).toBe(true);
    expect(isInitStep("setup")).toBe(false);
    expect(isInitStep("")).toBe(false);
  });
});
