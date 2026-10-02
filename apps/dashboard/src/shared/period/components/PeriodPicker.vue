<script setup lang="ts">
import { parseDate, toCalendarDate, type DateValue } from "@internationalized/date";
import { CalendarDays, ChevronDown } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import type { DateRange } from "reka-ui";
import { computed, ref, shallowRef } from "vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RangeCalendar } from "@/components/ui/range-calendar";
import { dayKey } from "../lib/local-day";
import {
  keptDays,
  oldestDay,
  periodLabel,
  rangeLabel,
  type Period,
  type PeriodPreset,
  type ResolvedPeriod,
} from "../lib/period";
import PeriodPresetList from "./PeriodPresetList.vue";

const props = defineProps<{
  period: Period;
  resolved: ResolvedPeriod;
  /** Today's local midnight, from the page's clock. */
  now: Date;
  retentionDays: number | null;
}>();
const emit = defineEmits<{ change: [period: Period] }>();

const open = ref(false);
const wide = useMediaQuery("(min-width: 640px)");
const draft = shallowRef<DateRange>({ start: undefined, end: undefined });
const placeholder = shallowRef<DateValue>(parseDate(dayKey(props.now)));

const label = computed(() => periodLabel(props.period, props.resolved, props.now));
const dates = computed(() =>
  props.period.kind === "preset" ? rangeLabel(props.resolved, props.now) : null,
);
const active = computed<PeriodPreset | null>(() =>
  props.period.kind === "preset" ? props.period.preset : null,
);
const months = computed(() => (wide.value ? 2 : 1));
const minValue = computed(() => parseDate(oldestDay(props.now, props.retentionDays)));
const maxValue = computed(() => parseDate(dayKey(props.now)));
const kept = computed(() => keptDays(props.retentionDays));

function toggle(value: boolean) {
  open.value = value;
  if (!value) return;
  const end = parseDate(props.resolved.lastDay);
  draft.value = { start: parseDate(props.resolved.firstDay), end };
  placeholder.value = months.value === 2 ? end.subtract({ months: 1 }) : end;
}

function choose(next: Period) {
  open.value = false;
  emit("change", next);
}

function applyRange(range: DateRange) {
  if (!range.start || !range.end) return;
  choose({
    kind: "custom",
    start: toCalendarDate(range.start).toString(),
    end: toCalendarDate(range.end).toString(),
  });
}
</script>

<template>
  <Popover :open="open" @update:open="toggle">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="max-w-full min-w-0" aria-haspopup="dialog">
        <CalendarDays class="text-muted-foreground" />
        <span class="truncate font-medium">{{ label }}</span>
        <span v-if="dates" class="text-muted-foreground hidden truncate font-normal sm:inline">{{
          dates
        }}</span>
        <ChevronDown class="text-muted-foreground size-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-auto max-w-[calc(100vw-2rem)] p-0"
      aria-label="Choose a period"
    >
      <div class="flex flex-col sm:flex-row">
        <PeriodPresetList :active="active" @select="choose({ kind: 'preset', preset: $event })" />
        <div class="min-w-0">
          <RangeCalendar
            v-model="draft"
            v-model:placeholder="placeholder"
            :number-of-months="months"
            :min-value="minValue"
            :max-value="maxValue"
            :week-starts-on="1"
            calendar-label="Custom period"
            fixed-weeks
            @update:valid-model-value="applyRange"
          />
          <p
            class="text-muted-foreground flex items-center justify-between gap-3 border-t px-3 py-2 text-[11px]"
          >
            <span>Pick a first and a last day · {{ kept }} days kept</span>
            <span class="max-sm:hidden"><Kbd>Esc</Kbd> to cancel</span>
          </p>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
