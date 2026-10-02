<script setup lang="ts">
import { ChevronDown, Package } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import ArtefactKindToggle from "@/shared/delivery/components/ArtefactKindToggle.vue";
import { channelsServing, type ArtefactKind } from "@/shared/delivery/lib/eligibility";
import type { Artefact } from "@/shared/types/release";
import { useCanvasContext } from "../composables/useCanvasContext";
import ArtefactChip from "./ArtefactChip.vue";

const SHELF_SIZE = 12;

const { catalog } = useCanvasContext();
const STORAGE_KEY = "capuchoo.canvas.shelf-open";
const open = ref(readOpen());

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

watch(open, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    return;
  }
});
const kind = ref<ArtefactKind>("ota");

const newestFirst = (a: Artefact, b: Artefact) =>
  (b.created_at ?? "").localeCompare(a.created_at ?? "");

const items = computed(() => {
  const list: Artefact[] =
    kind.value === "ota" ? [...catalog.value.bundles] : [...catalog.value.natives];
  return list
    .sort(newestFirst)
    .slice(0, SHELF_SIZE)
    .map((artefact) => ({
      artefact,
      servedBy: channelsServing(artefact.id, catalog.value.channels)
        .map((channel) => channel.name)
        .join(", "),
    }));
});
</script>

<template>
  <Collapsible v-model:open="open" class="relative">
    <CollapsibleTrigger
      class="hover:bg-accent flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium"
    >
      <Package class="size-4" />
      Releases
      <span class="text-muted-foreground text-xs font-normal">drag onto a channel</span>
      <ChevronDown
        class="text-muted-foreground ml-auto size-4 transition-transform"
        :class="open && 'rotate-180'"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="bg-card/95 absolute top-full right-0 mt-2 w-72 space-y-2 rounded-lg border p-3 shadow-md backdrop-blur"
    >
      <ArtefactKindToggle v-model="kind" />
      <p v-if="items.length === 0" class="text-muted-foreground py-4 text-center text-xs">
        Nothing uploaded yet.
      </p>
      <ul v-else class="nowheel max-h-80 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
        <li
          v-for="{ artefact, servedBy } in items"
          :key="artefact.id"
          class="flex items-center justify-between gap-2"
        >
          <ArtefactChip :artefact="artefact" show-flavour />
          <span class="text-muted-foreground truncate text-right text-[11px]">
            <template v-if="servedBy">on {{ servedBy }}</template>
            <RelativeTime v-else :value="artefact.created_at" />
          </span>
        </li>
      </ul>
    </CollapsibleContent>
  </Collapsible>
</template>
