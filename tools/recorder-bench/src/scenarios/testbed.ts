import { loopFor, type AppUnderTest, type Scenario, type StepContext } from "./types.ts";

/** The capuchoo testbed: Framework7 tabs (home, demo, settings), selectors read off the live app. */

const TAB = (id: string) => `.toolbar-pane a.tab-link[data-tab="#view-${id}"]`;
const UPDATE_LATER = "a.sheet-close";
const FAB = "#view-demo .fab > a";
const FAB_ACTION = "#view-demo .fab-buttons a";
const ORDER = "#demo-tab-data li a.item-link";
const ORDER_BACK = "#view-demo .page-current .navbar a.back";
const SEARCH_LINK = '#view-demo a[href="/demo/search/"]';
const SEARCH_INPUT = "#view-demo .searchbar input";
const DIAGNOSTICS = 'a.tab-link[data-tab="#demo-tab-diagnostics"]';
const DATA = 'a.tab-link[data-tab="#demo-tab-data"]';
const RUN_BENCHMARK = "#demo-tab-diagnostics .button";

/** Switches tab and waits for it to be the active view; the bar hides while a page scrolls. */
async function switchTab(ui: StepContext["ui"], id: string) {
  await ui.tapUntil(
    TAB(id),
    `document.querySelector("#view-${id}")?.classList.contains("tab-active")`,
  );
  await ui.sleep(400);
}

async function openDemo({ ui }: StepContext) {
  await switchTab(ui, "demo");
}

/** The updater offers the dev channel's newer bundle on launch; every arm says Later the same way. */
async function dismissUpdateOffer({ ui }: StepContext) {
  try {
    await ui.tap(UPDATE_LATER, { text: "Later", timeoutMs: 2500 });
    await ui.sleep(600);
  } catch {
    // No offer this launch.
  }
}

const coldStart: Scenario = {
  name: "cold-start",
  summary: "Launch, reach the first screen, settle",
  seconds: { quick: 8, standard: 10, soak: 10 },
  sampleEveryMs: 2000,
  async run({ ui, seconds }) {
    await ui.sleep(seconds * 1000);
  },
};

const idle: Scenario = {
  name: "idle",
  summary: "On the home screen, untouched",
  seconds: { quick: 45, standard: 90, soak: 90 },
  sampleEveryMs: 10_000,
  async run({ ui, seconds }) {
    await ui.sleep(seconds * 1000);
  },
};

const navigate: Scenario = {
  name: "navigate",
  summary: "Switch tabs, scroll the order list, open an order and come back",
  seconds: { quick: 40, standard: 60, soak: 60 },
  sampleEveryMs: 5000,
  async run(context) {
    const { ui } = context;
    await loopFor(context.seconds, async (round) => {
      await openDemo(context);
      await ui.scroll(1);
      await ui.sleep(450);
      await ui.scroll(-1);
      await ui.sleep(400);
      await ui.tap(ORDER, { reveal: true });
      await ui.sleep(1200);
      await ui.tap(ORDER_BACK);
      await ui.sleep(700);
      await switchTab(ui, round % 2 === 0 ? "home" : "settings");
      await ui.sleep(500);
      await ui.scroll(1);
      await ui.sleep(450);
      await ui.scroll(-1);
      await ui.sleep(400);
    });
    await switchTab(ui, "home");
  },
};

const typing: Scenario = {
  name: "typing",
  summary: "Search orders by typing their numbers, clear, type again",
  seconds: { quick: 30, standard: 45, soak: 45 },
  sampleEveryMs: 5000,
  async run(context) {
    const { ui } = context;
    await openDemo(context);
    await ui.tap(SEARCH_LINK);
    await ui.sleep(900);
    await ui.tap(SEARCH_INPUT);
    const words = ["SO-65", "SO-64", "SO-6", "SO-649", "SO-650"];
    await loopFor(context.seconds, async (round) => {
      const word = words[round % words.length]!;
      await ui.type(word);
      await ui.sleep(900);
      await ui.erase(word.length);
      await ui.sleep(300);
    });
    await ui.back();
    await ui.sleep(500);
    await ui.back();
    await ui.sleep(600);
  },
};

const dbBurst: Scenario = {
  name: "db-burst",
  summary: "The testbed's database benchmark: bulk writes, reads and joins",
  seconds: { quick: 60, standard: 90, soak: 90 },
  sampleEveryMs: 3000,
  async run(context) {
    const { ui } = context;
    await openDemo(context);
    await ui.tap(DIAGNOSTICS);
    await ui.sleep(800);
    await ui.tap(RUN_BENCHMARK, { text: "Run benchmark", reveal: true });
    await ui.sleep(1000);
    await ui.until(
      `[...document.querySelectorAll(${JSON.stringify(RUN_BENCHMARK)})].some((b) => b.textContent.includes("Run benchmark") && !b.classList.contains("disabled"))`,
      context.seconds * 1000,
    );
    await ui.tap(DATA);
  },
};

const errorStorm: Scenario = {
  name: "error-storm",
  summary: "200 errors: thrown, logged without a stack, and unhandled rejections",
  seconds: { quick: 20, standard: 30, soak: 30 },
  sampleEveryMs: 3000,
  async run({ page, ui, seconds }) {
    await page.evaluate(`(async () => {
      for (let i = 0; i < 200; i += 1) {
        if (i % 3 === 0) console.error(new TypeError("bench: cannot read total of undefined (" + i + ")"));
        else if (i % 3 === 1) console.error({ message: "bench: Unable to resolve host", code: "UnknownHostException" });
        else Promise.reject(new Error("bench: rejected " + i));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    })()`);
    await ui.sleep(Math.max(0, seconds * 1000 - 5000));
  },
};

const soak: Scenario = {
  name: "soak",
  summary: "Navigation and database bursts on a loop, for memory growth over time",
  seconds: { quick: 120, standard: 600, soak: 1200 },
  sampleEveryMs: 30_000,
  async run(context) {
    await loopFor(context.seconds, async (round) => {
      await navigate.run({ ...context, seconds: 45 });
      if (round % 2 === 1) await dbBurst.run({ ...context, seconds: 90 });
      await switchTab(context.ui, "home");
    });
  },
};

export const TESTBED: AppUnderTest = {
  name: "capuchoo-testbed",
  packageName: "com.ayb.capuchootestbed.recorder",
  async prepare(context) {
    const { ui } = context;
    await dismissUpdateOffer(context);
    await openDemo(context);
    await ui.tap(FAB);
    await ui.sleep(600);
    await ui.tap(FAB_ACTION, { text: "Seed" });
    await ui.until(`document.querySelectorAll(${JSON.stringify(ORDER)}).length > 0`, 30_000);
    await switchTab(ui, "home");
    await ui.sleep(500);
  },
  beforeMeasuring: dismissUpdateOffer,
  scenarios: [coldStart, idle, navigate, typing, dbBurst, errorStorm, soak],
};
