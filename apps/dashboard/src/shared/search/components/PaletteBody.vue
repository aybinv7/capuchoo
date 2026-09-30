<script setup lang="ts">
import { CornerDownLeft, Search, SearchX } from "@lucide/vue";
import { ListboxFilter } from "reka-ui";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { errorMessage } from "../../api/errors";
import { useCommandStore } from "../../stores/command.store";
import { SCOPE_LABELS, usePaletteResults } from "../composables/usePaletteResults";
import type { SearchItem, SearchScope } from "../types";

const store = useCommandStore();
const router = useRouter();

const query = ref("");
const chosen = ref<SearchScope>("all");
const { groups, scope, available, prefixed, searchingDevices } = usePaletteResults(query, chosen);

const HINTS: { key: string; label: string }[] = [
  { key: ">", label: "actions" },
  { key: "#", label: "channels" },
  { key: "@", label: "devices" },
];

function choose(next: SearchScope) {
  chosen.value = next;
  if (prefixed.value) query.value = query.value.trimStart().slice(1).trimStart();
}

function cycleScope(step: 1 | -1) {
  const order: SearchScope[] = ["all", ...available.value];
  const index = order.indexOf(scope.value);
  choose(order[(index + step + order.length) % order.length]!);
}

async function run(item: SearchItem) {
  store.remember(item.id);
  store.open = false;
  try {
    if (item.to) await router.push(item.to);
    else await item.run?.();
  } catch (error) {
    toast.error(`Could not open ${item.label}`, { description: errorMessage(error) });
  }
}
</script>

<template>
  <Command class="rounded-none bg-transparent">
    <div class="flex h-12 items-center gap-2 border-b px-3">
      <Search class="size-4 shrink-0 opacity-50" />
      <ListboxFilter
        v-model="query"
        auto-focus
        placeholder="Search pages, channels, releases, builds, devices…"
        aria-label="Search"
        class="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-hidden"
        @keydown.tab.prevent="cycleScope($event.shiftKey ? -1 : 1)"
      />
      <Spinner v-if="searchingDevices" class="text-muted-foreground size-4" />
    </div>
    <div class="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5" role="tablist">
      <button
        v-for="option in ['all', ...available] as SearchScope[]"
        :key="option"
        type="button"
        role="tab"
        :aria-selected="scope === option"
        :class="
          cn(
            'shrink-0 rounded-md px-2 py-1 text-xs transition-colors',
            scope === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )
        "
        @click="choose(option)"
      >
        {{ option === "all" ? "All" : SCOPE_LABELS[option] }}
      </button>
    </div>
    <CommandList class="max-h-[min(26rem,60svh)] p-1">
      <div
        v-if="groups.length === 0"
        class="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm"
      >
        <SearchX class="size-5" />
        <span v-if="searchingDevices">Searching devices…</span>
        <span v-else>No result. Try another word or scope.</span>
      </div>
      <CommandGroup v-for="group in groups" :key="group.key" :heading="group.label">
        <CommandItem
          v-for="item in group.items"
          :key="`${group.key}:${item.id}`"
          :value="`${group.key}:${item.id}`"
          class="py-2"
          @select="run(item)"
        >
          <component :is="item.icon" v-if="item.icon" class="size-4" />
          <div class="grid min-w-0 flex-1 leading-tight">
            <span class="truncate">{{ item.label }}</span>
            <span v-if="item.hint" class="text-muted-foreground truncate text-xs">{{
              item.hint
            }}</span>
          </div>
          <CommandShortcut v-if="item.shortcut">{{ item.shortcut }}</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
    <div
      class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px]"
    >
      <span class="flex items-center gap-1"
        ><Kbd><CornerDownLeft /></Kbd> open</span
      >
      <span class="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
      <span class="flex items-center gap-1"><Kbd>Tab</Kbd> scope</span>
      <span class="ml-auto flex items-center gap-2">
        <span v-for="hint in HINTS" :key="hint.key" class="flex items-center gap-1"
          ><Kbd>{{ hint.key }}</Kbd> {{ hint.label }}</span
        >
      </span>
    </div>
  </Command>
</template>
