import { effectScope, nextTick, reactive, ref } from "vue";
import { describe, expect, it, vi } from "vite-plus/test";
import { breadcrumbLabelFor, useBreadcrumbLabel } from "./useBreadcrumbLabel";

const route = reactive({ path: "/apps/a/devices/d-1" });

vi.mock("vue-router", () => ({ useRoute: () => route }));

function mount(label: () => string | null) {
  const scope = effectScope();
  scope.run(() => useBreadcrumbLabel(label));
  return scope;
}

describe("useBreadcrumbLabel", () => {
  it("names the crumb after the record and follows the getter", async () => {
    route.path = "/apps/a/devices/d-1";
    const name = ref<string | null>("Pixel 8");
    const scope = mount(() => name.value);
    expect(breadcrumbLabelFor("/apps/a/devices/d-1")).toBe("Pixel 8");
    name.value = "  K. Haddad tablet ";
    await nextTick();
    expect(breadcrumbLabelFor("/apps/a/devices/d-1")).toBe("K. Haddad tablet");
    name.value = null;
    await nextTick();
    expect(breadcrumbLabelFor("/apps/a/devices/d-1")).toBeNull();
    scope.stop();
  });

  it("never leaks a label to another path", async () => {
    route.path = "/apps/a/devices/d-1";
    const scope = mount(() => "Pixel 8");
    expect(breadcrumbLabelFor("/apps/a/devices")).toBeNull();
    route.path = "/apps/a/devices/d-2";
    await nextTick();
    expect(breadcrumbLabelFor("/apps/a/devices/d-1")).toBeNull();
    expect(breadcrumbLabelFor("/apps/a/devices/d-2")).toBe("Pixel 8");
    scope.stop();
  });

  it("is cleared on unmount, without dropping a newer page's claim", () => {
    route.path = "/apps/a/channels/c-1";
    const first = mount(() => "production");
    const second = mount(() => "staging");
    first.stop();
    expect(breadcrumbLabelFor("/apps/a/channels/c-1")).toBe("staging");
    second.stop();
    expect(breadcrumbLabelFor("/apps/a/channels/c-1")).toBeNull();
  });
});
