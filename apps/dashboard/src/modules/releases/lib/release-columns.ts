import type { AnyColumnDef } from "@/shared/components/data-table";
import { actionsColumn, selectionColumn } from "@/shared/components/data-table";
import type { ArtefactKind } from "@/shared/delivery/lib/eligibility";
import type { Artefact, Channel } from "@/shared/types/release";

/** Channels currently pointing at each artefact, built once per catalog instead of per row. */
export function servingIndex(channels: readonly Channel[]): Map<string, Channel[]> {
  const index = new Map<string, Channel[]>();
  const add = (id: string | null, channel: Channel) => {
    if (!id) return;
    const list = index.get(id);
    if (list) list.push(channel);
    else index.set(id, [channel]);
  };
  for (const channel of channels) {
    add(channel.current_bundle_id, channel);
    add(channel.current_native_id, channel);
  }
  return index;
}

/** Release table columns; cells are rendered by `ReleaseTable.vue` through `cell-<id>` slots. */
export function releaseColumns(
  kind: ArtefactKind,
  serving: ReadonlyMap<string, readonly Channel[]>,
): AnyColumnDef<Artefact>[] {
  const servedBy = (artefact: Artefact) =>
    (serving.get(artefact.id) ?? []).map((channel) => channel.name).join(", ");

  return [
    selectionColumn<Artefact>(),
    {
      id: "version",
      accessorFn: (artefact) => artefact.version_name,
      sortingFn: "alphanumeric",
      size: 180,
      meta: { title: "Version" },
    },
    ...(kind === "native"
      ? [
          {
            id: "version_code",
            accessorFn: (artefact: Artefact) =>
              artefact.kind === "native" ? artefact.version_code : null,
            size: 110,
            meta: { title: "Build number", align: "right" as const },
          },
        ]
      : []),
    {
      id: "flavour",
      accessorFn: (artefact) => artefact.flavour ?? "",
      size: 110,
      meta: { title: "Flavour", facetLabel: (value: string) => value || "unflavoured" },
    },
    {
      id: "platform",
      accessorFn: (artefact) => artefact.platform,
      size: 100,
      meta: { title: "Platform" },
    },
    {
      id: "size",
      accessorFn: (artefact) => artefact.size_bytes,
      enableGlobalFilter: false,
      size: 100,
      meta: { title: "Size", align: "right" },
    },
    {
      id: "signed",
      accessorFn: (artefact) => artefact.signed,
      enableGlobalFilter: false,
      size: 90,
      meta: {
        title: "Signed",
        facetLabel: (value: boolean) => (value ? "Signed" : "Unsigned"),
      },
    },
    {
      id: "required",
      accessorFn: (artefact) => artefact.required,
      enableGlobalFilter: false,
      size: 100,
      meta: {
        title: "Required",
        defaultHidden: true,
        facetLabel: (value: boolean) => (value ? "Required" : "Optional"),
      },
    },
    {
      id: "served",
      accessorFn: servedBy,
      enableSorting: false,
      size: 200,
      meta: { title: "Served by" },
    },
    {
      id: "uploaded",
      accessorFn: (artefact) => artefact.created_at ?? "",
      sortingFn: "basic",
      enableGlobalFilter: false,
      size: 140,
      meta: { title: "Uploaded" },
    },
    {
      id: "uploaded_by",
      accessorFn: (artefact) => artefact.uploaded_by ?? "",
      size: 180,
      meta: { title: "Uploaded by", defaultHidden: true },
    },
    {
      id: "notes",
      accessorFn: (artefact) => artefact.release_notes ?? "",
      enableSorting: false,
      size: 240,
      meta: { title: "Notes", defaultHidden: true, cellClass: "max-w-80 truncate" },
    },
    actionsColumn<Artefact>(),
  ];
}
