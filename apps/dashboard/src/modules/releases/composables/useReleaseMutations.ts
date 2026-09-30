import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { toast } from "vue-sonner";
import { errorMessage, errorTitle } from "@/shared/api/errors";
import { queryKeys } from "@/shared/api/query-keys";
import type { Artefact, ReleaseCatalog } from "@/shared/types/release";
import { deleteRelease, fetchDownloadLink, patchRelease } from "../services/releases.service";
import type { ReleasePatch } from "../types/releases.types";

/** The PATCH answer omits the uploader's email, so the cached one is kept. */
function replaceArtefact(catalog: ReleaseCatalog, artefact: Artefact): ReleaseCatalog {
  if (artefact.kind === "ota")
    return {
      ...catalog,
      bundles: catalog.bundles.map((entry) =>
        entry.id === artefact.id
          ? { ...artefact, uploaded_by: artefact.uploaded_by ?? entry.uploaded_by }
          : entry,
      ),
    };
  return {
    ...catalog,
    natives: catalog.natives.map((entry) =>
      entry.id === artefact.id
        ? { ...artefact, uploaded_by: artefact.uploaded_by ?? entry.uploaded_by }
        : entry,
    ),
  };
}

function dropArtefact(catalog: ReleaseCatalog, artefact: Artefact): ReleaseCatalog {
  return artefact.kind === "ota"
    ? { ...catalog, bundles: catalog.bundles.filter((entry) => entry.id !== artefact.id) }
    : { ...catalog, natives: catalog.natives.filter((entry) => entry.id !== artefact.id) };
}

/** Editing, deleting and downloading an artefact; the catalog cache is patched with the answer. */
export function useReleaseMutations(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const setCatalog = (transform: (catalog: ReleaseCatalog) => ReleaseCatalog) =>
    client.setQueryData<ReleaseCatalog>(queryKeys.catalog(toValue(appId)), (catalog) =>
      catalog ? transform(catalog) : catalog,
    );

  const update = useMutation({
    mutationFn: ({ artefact, patch }: { artefact: Artefact; patch: ReleasePatch }) =>
      patchRelease(artefact, patch),
    onSuccess: (artefact) => setCatalog((catalog) => replaceArtefact(catalog, artefact)),
  });

  const remove = useMutation({
    mutationFn: (artefact: Artefact) => deleteRelease(artefact),
    onSuccess: (_result, artefact) => setCatalog((catalog) => dropArtefact(catalog, artefact)),
  });

  const download = useMutation({
    mutationFn: (artefact: Artefact) => fetchDownloadLink(artefact),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(errorTitle(error), { description: errorMessage(error) }),
  });

  return { update, remove, download };
}
