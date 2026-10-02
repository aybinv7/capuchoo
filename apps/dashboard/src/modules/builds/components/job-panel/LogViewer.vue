<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import "@/assets/styles/ansi.css";
import { cn } from "@/lib/utils";
import { useVirtualRows } from "@/shared/composables/useVirtualRows";
import { linePieces } from "../../lib/log-pieces";
import { buildLogRows, formatLogTime, widestLine, type LogRow } from "../../lib/log-rows";
import type { LogLine, LogLineKind } from "../../types/job-logs.types";

const props = defineProps<{
  lines: readonly LogLine[];
  /** Normalized search text. */
  needle: string;
  timestamps: boolean;
  label: string;
}>();

const ROW_HEIGHT = 20;
const VIRTUAL_FROM = 400;

const toggled = shallowRef<ReadonlySet<number>>(new Set());
const result = computed(() =>
  buildLogRows({ lines: props.lines, toggled: toggled.value, needle: props.needle }),
);
const rows = computed(() => result.value.rows);
const virtual = computed(() => rows.value.length > VIRTUAL_FROM);

const scroller = useTemplateRef<HTMLElement>("scroller");
const windowed = useVirtualRows({
  container: scroller,
  count: computed(() => rows.value.length),
  rowHeight: ROW_HEIGHT,
  enabled: virtual,
});

const visible = computed(() => {
  if (!virtual.value) return rows.value;
  const { start, end } = windowed.range.value;
  return rows.value.slice(start, end);
});

const gutterRem = computed(() => (props.timestamps ? 9.5 : 4.5));
const sizer = computed(() => {
  if (!virtual.value) return undefined;
  return {
    height: `${windowed.totalHeight.value}px`,
    minWidth: `calc(${widestLine(props.lines)}ch + ${gutterRem.value + 2}rem)`,
  };
});
const shift = computed(() =>
  virtual.value ? { transform: `translateY(${windowed.offset.value}px)` } : undefined,
);

watch(
  () => props.needle,
  (needle) => {
    if (!needle) return;
    const index = rows.value.findIndex((row) => row.match);
    if (index !== -1) windowed.scrollToRow(index);
  },
  { flush: "post" },
);

function toggle(row: LogRow) {
  const next = new Set(toggled.value);
  if (next.has(row.number)) next.delete(row.number);
  else next.add(row.number);
  toggled.value = next;
}

const ROW_TONE: Partial<Record<LogLineKind, string>> = {
  error: "bg-danger-soft",
  warning: "bg-warning-soft",
};

const PREFIX: Partial<Record<LogLineKind, { text: string; class: string }>> = {
  error: { text: "Error: ", class: "text-destructive font-semibold" },
  warning: { text: "Warning: ", class: "text-warning font-semibold" },
  notice: { text: "Notice: ", class: "text-info font-semibold" },
  debug: { text: "Debug: ", class: "text-env-dev" },
};

const TEXT_TONE: Partial<Record<LogLineKind, string>> = {
  command: "text-muted-foreground",
  debug: "text-muted-foreground",
  group: "font-medium",
};
</script>

<template>
  <div
    ref="scroller"
    class="log-viewer ansi-palette bg-surface max-h-[min(65vh,42rem)] overflow-auto overscroll-contain font-mono text-xs leading-5 focus-visible:outline-2"
    role="log"
    :aria-label="props.label"
    tabindex="0"
  >
    <div :class="cn('relative', !virtual && 'w-max min-w-full')" :style="sizer">
      <div :style="shift">
        <div
          v-for="row in visible"
          :key="row.number"
          :class="
            cn(
              'flex h-5 min-w-full items-center whitespace-pre',
              ROW_TONE[row.line.kind] ?? 'bg-surface hover:bg-muted',
            )
          "
        >
          <span
            class="text-muted-foreground/70 sticky left-0 w-12 shrink-0 bg-inherit pr-3 text-right tabular select-none"
            aria-hidden="true"
            >{{ row.number }}</span
          >
          <span
            v-if="props.timestamps"
            class="text-muted-foreground w-20 shrink-0 tabular select-none"
            >{{ formatLogTime(row.line.time) }}</span
          >
          <button
            v-if="row.kind === 'group'"
            type="button"
            class="hover:text-foreground flex h-5 items-center gap-1 pr-2 text-left"
            :aria-expanded="row.open"
            @click="toggle(row)"
          >
            <ChevronRight
              :class="cn('size-3 shrink-0 transition-transform', row.open && 'rotate-90')"
            />
            <span :class="TEXT_TONE.group">
              <span
                v-for="(piece, index) in linePieces(row.line, props.needle)"
                :key="index"
                :class="[piece.class, piece.match && 'log-match']"
                :style="piece.style"
                >{{ piece.text }}</span
              >
            </span>
            <span v-if="!row.open" class="text-muted-foreground ml-2">
              {{ row.size }} {{ row.size === 1 ? "line" : "lines" }}
            </span>
          </button>
          <span v-else :class="cn('pr-4', row.nested && 'pl-4', TEXT_TONE[row.line.kind])">
            <span v-if="PREFIX[row.line.kind]" :class="PREFIX[row.line.kind]!.class">{{
              PREFIX[row.line.kind]!.text
            }}</span>
            <span
              v-for="(piece, index) in linePieces(row.line, props.needle)"
              :key="index"
              :class="[piece.class, piece.match && 'log-match']"
              :style="piece.style"
              >{{ piece.text }}</span
            >
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.log-viewer .log-match {
  border-radius: 2px;
  background-color: color-mix(in oklch, var(--warning) 45%, transparent);
  color: var(--foreground);
}
</style>
