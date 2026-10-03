<script setup lang="ts">
import { Database, Search, TableProperties, TriangleAlert } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { formatOffset } from "../../lib/activity";
import { changeKey } from "../../lib/changeset";
import { tableAt } from "../../lib/db-model";
import { databasesOf, entriesOf, summarizeTables, tableShape } from "../../lib/db-tables";
import { displayValue } from "../../lib/display";
import type { Lanes } from "../../types/recordings.types";
import TableGrid from "./TableGrid.vue";

const props = defineProps<{ lanes: Lanes; playhead: number; origin: number }>();
const emit = defineEmits<{ seek: [time: number] }>();
const focus = defineModel<{ db: string; table: string } | null>("focus", { default: null });

/** The grid rebuilds four times a second at most, however fast the playhead moves. */
const STEP_MS = 250;
const stepped = computed(() => Math.floor(props.playhead / STEP_MS) * STEP_MS);

const databases = computed(() => databasesOf(props.lanes));
const db = ref<string>("");
const table = ref<string>("");
const changedOnly = ref(false);
const needle = ref("");

watch(
  databases,
  (list) => {
    if (!list.includes(db.value)) db.value = list[0] ?? "";
  },
  { immediate: true },
);

watch(focus, (next) => {
  if (!next) return;
  db.value = next.db;
  table.value = next.table;
});

const tables = computed(() =>
  db.value ? summarizeTables(props.lanes, db.value, stepped.value) : [],
);
watch(
  tables,
  (list) => {
    if (!list.some((summary) => summary.name === table.value)) table.value = list[0]?.name ?? "";
  },
  { immediate: true },
);

const view = computed(() => {
  if (!db.value || !table.value) return null;
  const shape = tableShape(props.lanes, db.value, table.value);
  return tableAt({
    name: table.value,
    columns: shape.columns,
    keyColumns: shape.keyColumns,
    snapshot: props.lanes.snapshots[db.value]?.[table.value] ?? null,
    entries: entriesOf(props.lanes, db.value),
    time: stepped.value,
  });
});

const rows = computed(() => {
  const all = view.value?.rows ?? [];
  const query = needle.value.trim().toLowerCase();
  return all.filter(
    (row) =>
      (!changedOnly.value || row.status !== "baseline") &&
      (!query || row.values.some((value) => displayValue(value).toLowerCase().includes(query))),
  );
});

const log = computed(() => {
  if (!db.value || !table.value) return [];
  const items: Array<{ id: string; t: number; op: string; key: string }> = [];
  for (const entry of entriesOf(props.lanes, db.value)) {
    entry.changes.forEach((change, index) => {
      if (change.table === table.value) {
        items.push({
          id: `${entry.id}:${index}`,
          t: entry.t,
          op: change.op,
          key: changeKey(change),
        });
      }
    });
  }
  return items;
});

const OP_TONE: Record<string, string> = {
  insert: "text-success",
  update: "text-warning",
  delete: "text-destructive",
};
const OP_MARK: Record<string, string> = { insert: "+", update: "~", delete: "−" };
</script>

<template>
  <div class="bg-background flex h-full min-h-0">
    <aside class="flex w-52 shrink-0 flex-col border-r">
      <div class="flex items-center gap-2 border-b px-3 py-2">
        <Database class="text-muted-foreground size-4" aria-hidden="true" />
        <Select v-if="databases.length > 1" v-model="db">
          <SelectTrigger size="sm" class="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="name in databases" :key="name" :value="name">{{ name }}</SelectItem>
          </SelectContent>
        </Select>
        <span v-else class="truncate text-xs font-medium">{{ db || "No database" }}</span>
      </div>
      <nav class="min-h-0 flex-1 overflow-y-auto p-1" aria-label="Tables">
        <button
          v-for="summary in tables"
          :key="summary.name"
          type="button"
          :class="
            cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
              summary.name === table ? 'bg-accent font-medium' : 'hover:bg-accent/60',
            )
          "
          @click="table = summary.name"
        >
          <TableProperties class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate font-mono">{{ summary.name }}</span>
          <span class="flex shrink-0 gap-1 font-mono text-[10px]">
            <span v-if="summary.inserted" class="text-success">+{{ summary.inserted }}</span>
            <span v-if="summary.updated" class="text-warning">~{{ summary.updated }}</span>
            <span v-if="summary.deleted" class="text-destructive">−{{ summary.deleted }}</span>
            <span
              v-if="
                !summary.inserted && !summary.updated && !summary.deleted && summary.rows !== null
              "
              class="text-muted-foreground tabular"
              >{{ summary.rows }}</span
            >
          </span>
        </button>
        <p v-if="tables.length === 0" class="text-muted-foreground p-3 text-xs text-pretty">
          No database was recorded. The app registers a database source, and the rules turn the
          Database track on.
        </p>
      </nav>
    </aside>

    <section v-if="view" class="flex min-w-0 flex-1 flex-col">
      <header class="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h3 class="font-mono text-sm font-semibold">{{ view.name }}</h3>
        <span class="text-muted-foreground tabular text-xs">{{ view.rows.length }} rows</span>
        <span class="flex items-center gap-2 text-[11px]" aria-label="Legend">
          <span class="flex items-center gap-1"
            ><span class="bg-success size-2 rounded-sm" />{{ view.counts.inserted }} inserted</span
          >
          <span class="flex items-center gap-1"
            ><span class="bg-warning size-2 rounded-sm" />{{ view.counts.updated }} updated</span
          >
          <span class="flex items-center gap-1"
            ><span class="bg-destructive size-2 rounded-sm" />{{
              view.counts.deleted
            }}
            deleted</span
          >
        </span>
        <div class="ml-auto flex items-center gap-2">
          <Toggle v-model="changedOnly" size="sm" variant="outline" class="h-7 text-xs">
            Changed only
          </Toggle>
          <InputGroup class="h-7 w-44">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput v-model="needle" placeholder="Find a value" class="text-xs" />
          </InputGroup>
        </div>
      </header>
      <p
        v-if="!view.complete"
        class="bg-warning-soft text-foreground flex items-center gap-2 border-b px-3 py-1.5 text-[11px]"
      >
        <TriangleAlert class="text-warning size-3.5 shrink-0" aria-hidden="true" />
        {{
          view.truncated
            ? "The starting state was cut at the row limit; rows past it appear only once written."
            : "No starting state was recorded for this table, so only rows this session wrote are shown."
        }}
      </p>
      <div class="min-h-0 flex-1">
        <TableGrid :table="view" :rows="rows" :playhead="props.playhead" />
      </div>
      <footer class="max-h-28 shrink-0 overflow-y-auto border-t">
        <ol class="divide-border/60 divide-y font-mono text-[11px]">
          <li v-for="item in log" :key="item.id">
            <button
              type="button"
              :class="
                cn(
                  'hover:bg-accent/60 flex w-full items-center gap-3 px-3 py-1 text-left',
                  item.t > props.playhead && 'opacity-45',
                )
              "
              @click="emit('seek', item.t)"
            >
              <span class="text-muted-foreground tabular w-10">{{
                formatOffset(item.t - props.origin)
              }}</span>
              <span :class="cn('w-3 font-bold', OP_TONE[item.op])">{{ OP_MARK[item.op] }}</span>
              <span class="w-14">{{ item.op }}</span>
              <span class="text-muted-foreground truncate">#{{ item.key }}</span>
            </button>
          </li>
        </ol>
      </footer>
    </section>
  </div>
</template>
