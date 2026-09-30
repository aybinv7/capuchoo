import type { Artefact } from "@/shared/types/release";
import type { ReleaseFilters } from "../types/releases.types";

export function filterReleases<T extends Artefact>(
  list: readonly T[],
  filters: ReleaseFilters,
): T[] {
  const term = filters.search.trim().toLowerCase();
  return list.filter(
    (artefact) =>
      (filters.flavour === "all" || artefact.flavour === filters.flavour) &&
      (filters.platform === "all" || artefact.platform === filters.platform) &&
      (!term ||
        artefact.version_name.toLowerCase().includes(term) ||
        (artefact.kind === "native" && String(artefact.version_code).includes(term)) ||
        (artefact.release_notes ?? "").toLowerCase().includes(term)),
  );
}
