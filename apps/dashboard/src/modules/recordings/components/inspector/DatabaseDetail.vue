<script setup lang="ts">
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import { changeKey, type DecodedChange } from "../../lib/changeset";
import { stateAt } from "../../lib/db-state";
import { columnNames, displayValue } from "../../lib/display";
import type {
  DatabaseColumn,
  DatabaseLaneEntry,
  DatabaseSnapshot,
} from "../../types/recordings.types";

const props = defineProps<{
  entry: DatabaseLaneEntry;
  /** Every database entry of the session, for the state view. */
  all: readonly DatabaseLaneEntry[];
  schemas: Record<string, Record<string, DatabaseColumn[]>>;
  /** Starting states, whose column names stand in when a session carries no schema. */
  snapshots: Record<string, Record<string, DatabaseSnapshot>>;
  playhead: number;
}>();

const emit = defineEmits<{ openTable: [db: string, table: string] }>();
const view = ref<"change" | "state">("change");
const OP_STYLE = {
  insert: "bg-success-soft text-success",
  update: "bg-warning-soft text-warning",
  delete: "bg-danger-soft text-destructive",
} as const;

const columnsOf = (table: string, count: number) =>
  columnNames(
    props.schemas[props.entry.db]?.[table] ??
      props.snapshots[props.entry.db]?.[table]?.columns.map((name) => ({ name })),
    count,
  );

const before = computed(() => {
  if (view.value !== "change") return null;
  const index = props.all.indexOf(props.entry);
  return stateAt(
    index < 0 ? [] : props.all.slice(0, index),
    Number.POSITIVE_INFINITY,
    props.entry.db,
  );
});

/** The change's own value, or - for a column an update left alone - the last value the session saw. */
function cell(change: DecodedChange, column: number): { text: string; inferred: boolean } {
  const own =
    change.op === "delete" || (change.op === "update" && change.new[column] === undefined)
      ? change.old[column]
      : change.new[column];
  if (own !== undefined) return { text: displayValue(own), inferred: false };
  const seen = before.value?.get(change.table)?.get(changeKey(change))?.values[column];
  return { text: displayValue(seen), inferred: seen !== undefined };
}

const rowsLabel = (count: number) => `${count} ${count === 1 ? "row" : "rows"}`;

const tables = computed(() => {
  if (view.value !== "state") return [];
  const state = stateAt(props.all, props.playhead, props.entry.db);
  return [...state.entries()].map(([name, rows]) => ({
    name,
    rows: [...rows.values()].sort((a, b) => b.changedAt - a.changedAt),
  }));
});
</script>

<template>
  <div class="space-y-3 p-3 text-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted-foreground"
        >{{ props.entry.db }} ·
        {{
          props.entry.kind === "changeset" ? rowsLabel(props.entry.changes.length) : "write"
        }}</span
      >
      <div class="bg-muted flex rounded-md p-0.5">
        <button
          v-for="option in [
            { value: 'change', label: 'This commit' },
            { value: 'state', label: 'Rows at playhead' },
          ] as const"
          :key="option.value"
          type="button"
          :class="
            cn(
              'rounded px-2 py-0.5',
              view === option.value ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )
          "
          @click="view = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <p v-if="props.entry.error" class="text-destructive">{{ props.entry.error }}</p>
    <p v-else-if="props.entry.kind === 'change'" class="text-muted-foreground text-pretty">
      {{ props.entry.type }} on
      <span class="text-foreground font-mono">{{ props.entry.table }}</span>
      <template v-if="props.entry.rows !== null"> · {{ rowsLabel(props.entry.rows) }}</template
      >. This engine reports which table changed, not the values.
    </p>

    <template v-else-if="view === 'change'">
      <section
        v-for="(change, index) in props.entry.changes"
        :key="index"
        class="overflow-hidden rounded-md border"
      >
        <header class="bg-muted/50 flex items-center gap-2 border-b px-2 py-1">
          <span
            :class="cn('rounded px-1.5 font-mono text-[10px] uppercase', OP_STYLE[change.op])"
            >{{ change.op }}</span
          >
          <span class="font-mono">{{ change.table }}</span>
          <button
            type="button"
            class="text-primary text-[11px] underline-offset-2 hover:underline"
            @click="emit('openTable', props.entry.db, change.table)"
          >
            Open table
          </button>
          <span class="text-muted-foreground ml-auto font-mono">#{{ changeKey(change) }}</span>
        </header>
        <table class="w-full font-mono text-[11px]">
          <tbody>
            <tr
              v-for="(name, column) in columnsOf(change.table, change.primaryKey.length)"
              :key="column"
              class="border-b last:border-0"
            >
              <th class="text-muted-foreground w-1/3 px-2 py-0.5 text-left font-normal">
                {{ name }}<span v-if="change.primaryKey[column]" class="text-primary"> ·key</span>
              </th>
              <td
                v-if="change.op === 'update'"
                class="text-muted-foreground px-2 py-0.5 line-through decoration-destructive/50"
              >
                {{ change.new[column] !== undefined ? displayValue(change.old[column]) : "" }}
              </td>
              <td
                :class="
                  cn(
                    'px-2 py-0.5 break-all',
                    change.op === 'update' && change.new[column] !== undefined && 'bg-warning-soft',
                    cell(change, column).inferred && 'text-muted-foreground italic',
                  )
                "
                :colspan="change.op === 'update' ? 1 : 2"
                :title="
                  cell(change, column).inferred
                    ? 'Unchanged; last value this session saw'
                    : undefined
                "
              >
                {{ cell(change, column).text }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <template v-else>
      <p v-if="tables.length === 0" class="text-muted-foreground">
        No rows written yet at this point.
      </p>
      <section v-for="table in tables" :key="table.name" class="space-y-1">
        <h4 class="font-mono font-medium">{{ table.name }}</h4>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full font-mono text-[11px]">
            <thead class="bg-muted/50">
              <tr>
                <th
                  v-for="name in columnsOf(table.name, table.rows[0]?.values.length ?? 0)"
                  :key="name"
                  class="text-muted-foreground px-2 py-1 text-left font-normal whitespace-nowrap"
                >
                  {{ name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in table.rows"
                :key="row.key"
                :class="cn('border-t', row.deleted && 'text-muted-foreground line-through')"
              >
                <td
                  v-for="(value, column) in row.values"
                  :key="column"
                  :class="
                    cn(
                      'px-2 py-0.5 whitespace-nowrap',
                      row.touched.includes(column) && !row.deleted && 'bg-info-soft',
                    )
                  "
                >
                  {{ displayValue(value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p class="text-muted-foreground text-pretty">
        Only rows this session wrote. Values the session never saw are blank.
      </p>
    </template>
  </div>
</template>
