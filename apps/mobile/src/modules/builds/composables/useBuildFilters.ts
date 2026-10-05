import type { AppRelease } from "@/shared/composables/release/useAppRelease";
import type { Environment } from "@/shared/database/schema";
import { ENVIRONMENT_ORDER } from "@/shared/release/lanes";
import { tick } from "@/shared/utils/native/haptics";

export type BuildKind = "native" | "ota";

/**
 * Native or OTA, and one flavour or all of them. A build with no flavour ships in every flavour,
 * so it stays under each one.
 */
export function useBuildFilters(release: Ref<AppRelease | null>) {
  const kind = ref<BuildKind>("native");
  const flavour = ref<Environment | null>(null);

  const flavours = computed(() => {
    const seen = new Set<Environment>();
    const rows = kind.value === "native" ? release.value?.natives : release.value?.bundles;
    for (const row of rows ?? []) if (row.flavour) seen.add(row.flavour);
    return ENVIRONMENT_ORDER.filter((env) => seen.has(env));
  });

  const matches = (row: { flavour: Environment | null }) =>
    flavour.value === null || row.flavour === null || row.flavour === flavour.value;

  const natives = computed(() => (release.value?.natives ?? []).filter(matches));
  const bundles = computed(() => (release.value?.bundles ?? []).filter(matches));

  function setKind(next: BuildKind): void {
    if (next === kind.value) return;
    tick();
    kind.value = next;
    flavour.value = null;
  }

  function setFlavour(next: Environment | null): void {
    if (next === flavour.value) return;
    tick();
    flavour.value = next;
  }

  return { kind, flavour, flavours, natives, bundles, setKind, setFlavour };
}
