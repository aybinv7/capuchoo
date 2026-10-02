import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watchEffect,
  type MaybeRefOrGetter,
} from "vue";
import { useRoute } from "vue-router";

interface Claim {
  path: string;
  label: string;
}

const claim = shallowRef<Claim | null>(null);

/** The label a page claimed for `path`, or null; a claim made on another path never leaks. */
export function breadcrumbLabelFor(path: string): string | null {
  const current = claim.value;
  return current && current.path === path ? current.label : null;
}

/**
 * Names the last breadcrumb after the record a detail page shows, instead of the route's generic
 * title. The claim follows the getter, is tied to the route path it was made on, and is dropped
 * when the page unmounts.
 */
export function useBreadcrumbLabel(label: MaybeRefOrGetter<string | null | undefined>): void {
  const route = useRoute();
  const path = computed(() => route.path);
  let owned: Claim | null = null;

  const release = () => {
    if (owned && claim.value === owned) claim.value = null;
    owned = null;
  };

  watchEffect(() => {
    const text = toValue(label)?.trim();
    release();
    if (!text) return;
    owned = { path: path.value, label: text };
    claim.value = owned;
  });

  onScopeDispose(release);
}

/** The current claim for a breadcrumb to read, scoped to the path it renders. */
export function useBreadcrumbClaim() {
  const route = useRoute();
  return computed(() => breadcrumbLabelFor(route.path));
}
