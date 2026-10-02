<script setup lang="ts">
import { ChevronsDown, ListTree } from "@lucide/vue";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { ChannelHistoryEntry } from "@/shared/types/release";
import ChannelHistoryTimeline from "./ChannelHistoryTimeline.vue";

const props = defineProps<{
  entries: readonly ChannelHistoryEntry[] | undefined;
  pending: boolean;
  error: unknown;
  retry: () => unknown;
}>();

const PAGE = 20;
const limit = ref(PAGE);
const all = computed(() => props.entries ?? []);
const shown = computed(() => all.value.slice(0, limit.value));
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header class="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
        <ListTree class="size-3.5" />
        History
      </span>
      <span v-if="all.length" class="text-muted-foreground font-mono text-xs tabular">{{
        all.length
      }}</span>
    </header>
    <div class="p-4">
      <ErrorNotice v-if="props.error && !props.entries" :error="props.error" :retry="props.retry" />
      <div v-else-if="props.pending" class="space-y-3" aria-busy="true">
        <Skeleton v-for="index in 4" :key="index" class="h-10 w-full" />
      </div>
      <p v-else-if="!all.length" class="text-muted-foreground py-6 text-center text-sm">
        Nothing has been delivered on this channel yet.
      </p>
      <template v-else>
        <ChannelHistoryTimeline :entries="shown" />
        <div v-if="all.length > shown.length" class="mt-4 flex justify-center">
          <Button variant="outline" size="sm" @click="limit += PAGE">
            <ChevronsDown />
            Show older
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
