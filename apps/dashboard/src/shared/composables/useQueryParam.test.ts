import { describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { useQueryParam } from "./useQueryParam";

async function setup(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/list", component: defineComponent({ render: () => h("div") }) }],
  });
  const app = createApp({ render: () => null });
  app.use(router);
  await router.push(path);
  await router.isReady();
  const params = app.runWithContext(() => ({
    device: useQueryParam<string>("device", ""),
    errors: useQueryParam<string>("errors", ""),
    start: useQueryParam<string>("start", ""),
  }));
  return { router, params };
}

async function settle() {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("useQueryParam", () => {
  it("clears several parameters written in the same tick", async () => {
    const { router, params } = await setup("/list?device=d1&errors=1&start=policy&keep=yes");

    params.device.value = "";
    params.errors.value = "";
    params.start.value = "";
    await settle();

    expect(router.currentRoute.value.query).toEqual({ keep: "yes" });
  });

  it("sets and clears in one navigation, and later writes start a new one", async () => {
    const { router, params } = await setup("/list?errors=1");

    params.errors.value = "";
    params.start.value = "shake";
    await settle();
    expect(router.currentRoute.value.query).toEqual({ start: "shake" });

    params.device.value = "d2";
    await settle();
    expect(router.currentRoute.value.query).toEqual({ start: "shake", device: "d2" });
  });
});
