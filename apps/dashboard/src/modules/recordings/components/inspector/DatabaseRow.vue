<script setup lang="ts">
import { computed } from "vue";
import type { DatabaseLaneEntry } from "../../types/recordings.types";

const props = defineProps<{ entry: DatabaseLaneEntry }>();

const summary = computed(() => {
  const counts = { insert: 0, update: 0, delete: 0 };
  for (const change of props.entry.changes) counts[change.op]++;
  return counts;
});
const tables = computed(() => {
  if (props.entry.kind === "change") return props.entry.table ?? "";
  return [...new Set(props.entry.changes.map((change) => change.table))].join(", ");
});
</script>

<template>
  <span class="flex shrink-0 gap-1 font-mono text-[10px]">
    <template v-if="props.entry.kind === 'changeset'">
      <span v-if="summary.insert" class="text-success">+{{ summary.insert }}</span>
      <span v-if="summary.update" class="text-warning">~{{ summary.update }}</span>
      <span v-if="summary.delete" class="text-destructive">−{{ summary.delete }}</span>
    </template>
    <span v-else class="text-muted-foreground uppercase">{{ props.entry.type }}</span>
  </span>
  <span class="min-w-0 flex-1 truncate font-mono text-[11px]" :title="tables">{{ tables }}</span>
  <span v-if="props.entry.error" class="text-destructive shrink-0 text-[10px]">unreadable</span>
  <span v-else class="text-muted-foreground shrink-0 text-[10px]">{{ props.entry.db }}</span>
</template>
