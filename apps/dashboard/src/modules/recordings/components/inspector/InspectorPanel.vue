<script setup lang="ts">
import {
  Database,
  Gauge,
  Globe,
  ListTree,
  LocateFixed,
  Radio,
  Search,
  SquareTerminal,
  X,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { buildActivity, type ActivityItem } from "../../lib/activity";
import type {
  ConsoleLaneEntry,
  DatabaseLaneEntry,
  Lanes,
  NetworkLaneEntry,
  PerfLaneEntry,
  TelemetryLaneEntry,
} from "../../types/recordings.types";
import ActivityRow from "./ActivityRow.vue";
import ConsoleRow from "./ConsoleRow.vue";
import DatabaseDetail from "./DatabaseDetail.vue";
import DatabaseRow from "./DatabaseRow.vue";
import EventList from "./EventList.vue";
import NetworkDetail from "./NetworkDetail.vue";
import NetworkRow from "./NetworkRow.vue";
import PerfSummary from "./PerfSummary.vue";
import TelemetryRow from "./TelemetryRow.vue";
import ConsoleDetail from "./ConsoleDetail.vue";
import TextDetail from "./TextDetail.vue";

type Tab = "activity" | "console" | "network" | "database" | "telemetry" | "perf";

const props = defineProps<{
  lanes: Lanes;
  playhead: number;
  origin: number;
  rage: ReadonlyArray<{ t: number }>;
  /** The app version the session ran, whose source maps read its stacks. */
  version: string;
}>();
const emit = defineEmits<{ seek: [time: number]; openTable: [db: string, table: string] }>();
const follow = defineModel<boolean>("follow", { required: true });

const tab = ref<Tab>("activity");
const needle = ref("");
const selected = ref<{ tab: Tab; id: string } | null>(null);

watch(tab, () => {
  needle.value = "";
});

const activity = computed(() => buildActivity(props.lanes, props.rage));

function matches(...parts: Array<string | null | undefined>): boolean {
  const query = needle.value.trim().toLowerCase();
  if (!query) return true;
  return parts.some((part) => part?.toLowerCase().includes(query));
}

const lists = computed(() => ({
  activity: activity.value.filter((item) => matches(item.title, item.detail)),
  console: props.lanes.console.filter((entry) => matches(entry.text)),
  network: props.lanes.network.filter((entry) =>
    matches(entry.url, entry.method, String(entry.status)),
  ),
  database: props.lanes.database.filter((entry) =>
    matches(entry.db, entry.table, ...entry.changes.map((change) => change.table)),
  ),
  telemetry: props.lanes.telemetry.filter((entry) => matches(entry.name, entry.message)),
  perf: props.lanes.perf.filter(
    (entry) => entry.kind === "longtask" || entry.kind === "interaction",
  ),
}));

const TABS = computed(() => [
  { value: "activity" as const, label: "Activity", count: activity.value.length, alert: 0 },
  {
    value: "console" as const,
    label: "Console",
    count: props.lanes.console.length,
    alert: props.lanes.console.filter((entry) => entry.level === "error").length,
  },
  {
    value: "network" as const,
    label: "Network",
    count: props.lanes.network.length,
    alert: props.lanes.network.filter((entry) => entry.error || (entry.status ?? 0) >= 400).length,
  },
  { value: "database" as const, label: "Database", count: props.lanes.database.length, alert: 0 },
  {
    value: "telemetry" as const,
    label: "Telemetry",
    count: props.lanes.telemetry.length,
    alert: 0,
  },
  { value: "perf" as const, label: "Performance", count: lists.value.perf.length, alert: 0 },
]);

const TAB_ICONS = {
  activity: ListTree,
  console: SquareTerminal,
  network: Globe,
  database: Database,
  telemetry: Radio,
  perf: Gauge,
} as const;

function select(current: Tab, item: { id: string }) {
  selected.value = { tab: current, id: item.id };
}

const detail = computed(() => {
  const choice = selected.value;
  if (!choice || choice.tab !== tab.value) return null;
  const find = <T extends { id: string }>(list: readonly T[]) =>
    list.find((entry) => entry.id === choice.id);
  switch (choice.tab) {
    case "console": {
      const entry = find(props.lanes.console);
      return entry ? { kind: "console" as const, entry } : null;
    }
    case "network": {
      const entry = find(props.lanes.network);
      return entry ? { kind: "network" as const, entry } : null;
    }
    case "database": {
      const entry = find(props.lanes.database);
      return entry ? { kind: "database" as const, entry } : null;
    }
    case "telemetry": {
      const entry = find(props.lanes.telemetry);
      return entry ? { kind: "telemetry" as const, entry } : null;
    }
    case "activity": {
      const item = find(activity.value);
      return item ? { kind: "activity" as const, item } : null;
    }
    default:
      return null;
  }
});

function openFromActivity(item: ActivityItem) {
  const lane = item.lane === "marker" ? null : item.lane;
  if (!lane) return;
  tab.value = lane;
  selected.value = { tab: lane, id: item.id };
}
</script>

<template>
  <div class="bg-background @container flex h-full min-h-0 flex-col">
    <Tabs v-model="tab" class="border-b">
      <TabsList
        class="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
      >
        <TabsTrigger
          v-for="item in TABS"
          :key="item.value"
          :value="item.value"
          class="data-[state=active]:border-primary flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent px-2.5 py-2 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none @md:px-3"
          :title="item.label"
          :aria-label="item.label"
        >
          <component :is="TAB_ICONS[item.value]" class="size-3.5 @md:hidden" aria-hidden="true" />
          <span class="hidden @md:inline">{{ item.label }}</span>
          <span
            v-if="item.alert"
            class="bg-destructive tabular rounded-full px-1.5 text-[10px] text-white"
            >{{ item.alert }}</span
          >
          <span v-else class="text-muted-foreground tabular text-[10px]">{{ item.count }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex items-center gap-2 border-b px-2 py-1.5">
      <InputGroup class="h-7 flex-1">
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput
          v-model="needle"
          placeholder="Filter"
          class="text-xs"
          aria-label="Filter"
        />
        <InputGroupAddon v-if="needle" align="inline-end">
          <Button variant="ghost" size="icon-xs" aria-label="Clear filter" @click="needle = ''">
            <X />
          </Button>
        </InputGroupAddon>
      </InputGroup>
      <Toggle
        v-model="follow"
        size="sm"
        aria-label="Follow the playhead"
        title="Keep the current event in view"
      >
        <LocateFixed />
      </Toggle>
    </div>

    <PerfSummary v-if="tab === 'perf'" :entries="props.lanes.perf" />

    <div :class="cn('min-h-0 flex-1', detail && 'max-h-[55%]')">
      <EventList
        v-if="tab === 'activity'"
        :items="lists.activity"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="selected?.tab === 'activity' ? selected.id : null"
        :follow="follow"
        empty-label="Nothing happened yet that is worth a line here."
        @select="openFromActivity"
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }"><ActivityRow :item="item" /></template>
      </EventList>
      <EventList
        v-else-if="tab === 'console'"
        :items="lists.console"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="selected?.tab === 'console' ? selected.id : null"
        :follow="follow"
        empty-label="No console output was recorded."
        @select="select('console', $event)"
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }"><ConsoleRow :entry="item as ConsoleLaneEntry" /></template>
      </EventList>
      <EventList
        v-else-if="tab === 'network'"
        :items="lists.network"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="selected?.tab === 'network' ? selected.id : null"
        :follow="follow"
        empty-label="No requests were recorded."
        @select="select('network', $event)"
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }"><NetworkRow :entry="item as NetworkLaneEntry" /></template>
      </EventList>
      <EventList
        v-else-if="tab === 'database'"
        :items="lists.database"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="selected?.tab === 'database' ? selected.id : null"
        :follow="follow"
        empty-label="No database writes were recorded. The app registers a database source to record them."
        @select="select('database', $event)"
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }"><DatabaseRow :entry="item as DatabaseLaneEntry" /></template>
      </EventList>
      <EventList
        v-else-if="tab === 'telemetry'"
        :items="lists.telemetry"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="selected?.tab === 'telemetry' ? selected.id : null"
        :follow="follow"
        empty-label="The app sent no telemetry. recorder.telemetry.event() and span() put it here."
        @select="select('telemetry', $event)"
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }"><TelemetryRow :entry="item as TelemetryLaneEntry" /></template>
      </EventList>
      <EventList
        v-else
        :items="lists.perf"
        :playhead="props.playhead"
        :origin="props.origin"
        :selected-id="null"
        :follow="follow"
        empty-label="No long tasks or slow interactions."
        @seek="emit('seek', $event)"
      >
        <template #row="{ item }">
          <span class="min-w-0 flex-1 truncate">{{
            (item as PerfLaneEntry).kind === "longtask"
              ? "Long task"
              : `Slow ${(item as PerfLaneEntry).name ?? "interaction"}`
          }}</span>
          <span class="tabular text-muted-foreground text-[10px]"
            >{{ (item as PerfLaneEntry).duration }} ms</span
          >
        </template>
      </EventList>
    </div>

    <div v-if="detail" class="min-h-0 flex-1 overflow-y-auto border-t">
      <NetworkDetail v-if="detail.kind === 'network'" :entry="detail.entry" />
      <DatabaseDetail
        v-else-if="detail.kind === 'database'"
        :entry="detail.entry"
        :all="props.lanes.database"
        :schemas="props.lanes.schemas"
        :snapshots="props.lanes.snapshots"
        :playhead="props.playhead"
        @open-table="(db, table) => emit('openTable', db, table)"
      />
      <ConsoleDetail
        v-else-if="detail.kind === 'console'"
        :entry="detail.entry"
        :version="props.version"
      />
      <TextDetail
        v-else-if="detail.kind === 'telemetry'"
        :title="detail.entry.name"
        :body="detail.entry.message ?? ''"
        :data="detail.entry.data"
        :extra="detail.entry.duration !== null ? `${detail.entry.duration} ms` : detail.entry.kind"
      />
    </div>
  </div>
</template>
