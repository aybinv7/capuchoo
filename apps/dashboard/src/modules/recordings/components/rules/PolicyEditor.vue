<script setup lang="ts">
import type {
  RecordingMode,
  RecordingPolicy,
  RecordingPolicyPatch,
  RecordingTrack,
  RecordingTrigger,
} from "@capuchoo/core";
import { RECORDING_LIMITS, RECORDING_MODES } from "@capuchoo/core";
import { computed } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { clearPatch, hasPath, mergePolicy, readPath, writePatch } from "../../lib/policy-form";
import PolicyField from "./PolicyField.vue";
import UnitInput from "./UnitInput.vue";

const props = defineProps<{ base: RecordingPolicy; inheritedFrom: string }>();
const patch = defineModel<RecordingPolicyPatch>({ required: true });

const effective = computed(() => mergePolicy(props.base, patch.value));
const value = <T>(path: string) => readPath(effective.value, path) as T;
const num = (path: string) => value<number>(path);
const bool = (path: string) => value<boolean>(path);
const modeOf = (path: string) => value<RecordingMode>(path);
const overridden = (path: string) => hasPath(patch.value, path);
const set = (path: string, next: unknown) => {
  patch.value =
    JSON.stringify(readPath(props.base, path)) === JSON.stringify(next) && !overridden(path)
      ? patch.value
      : writePatch(patch.value, path, next);
};
const reset = (path: string) => {
  patch.value = clearPatch(patch.value, path);
};

const MODES: Record<RecordingMode, { label: string; description: string }> = {
  off: { label: "Off", description: "Nothing runs on the device. No cost at all." },
  buffer: {
    label: "Buffer",
    description:
      "Keeps the last minutes on the device and uploads nothing until a trigger fires - then what led up to it goes up too.",
  },
  session: {
    label: "Session",
    description: "Records and uploads continuously, every few seconds.",
  },
  live: {
    label: "Live",
    description: "Uploads every second, for watching a device as it is used.",
  },
};

const TRACKS: Array<{ key: RecordingTrack; label: string; description: string }> = [
  { key: "replay", label: "Screen", description: "The page as the user saw it, through rrweb." },
  { key: "console", label: "Console", description: "Logs, warnings and uncaught errors." },
  { key: "network", label: "Network", description: "Every fetch and XHR, with timing and status." },
  {
    key: "database",
    label: "Database",
    description: "Committed SQLite writes with their row values, from the database worker.",
  },
  {
    key: "telemetry",
    label: "Telemetry",
    description: "Events, spans and measures the app sends through the recorder.",
  },
  { key: "perf", label: "Performance", description: "Long tasks, slow taps, paint and heap." },
];

const TRIGGERS: Array<{ key: RecordingTrigger; label: string; description: string }> = [
  { key: "shake", label: "Shake", description: "The user shakes the device to report." },
  { key: "error", label: "Error", description: "An uncaught error or console error." },
  { key: "manual", label: "Report", description: "A report button in the app." },
  { key: "app", label: "App code", description: "The app raises recording itself." },
];

const triggers = computed(() => value<RecordingTrigger[]>("triggers"));
function toggleTrigger(key: RecordingTrigger, on: boolean) {
  const next = new Set(triggers.value);
  if (on) next.add(key);
  else next.delete(key);
  set(
    "triggers",
    TRIGGERS.map((trigger) => trigger.key).filter((trigger) => next.has(trigger)),
  );
}

const tables = computed(() => value<string[] | "all">("database.tables"));
const limits = RECORDING_LIMITS;
const MINUTE = 60_000;
const MB = 1024 * 1024;
</script>

<template>
  <div class="divide-y">
    <section class="space-y-1 pb-4">
      <h3 class="text-sm font-semibold">When it records</h3>
      <PolicyField
        label="Mode"
        :description="MODES[modeOf('mode')].description"
        :overridden="overridden('mode')"
        :inherited-from="props.inheritedFrom"
        @reset="reset('mode')"
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="modeOf('mode')"
          @update:model-value="$event && set('mode', $event)"
        >
          <ToggleGroupItem v-for="mode in RECORDING_MODES" :key="mode" :value="mode" class="px-2.5">
            {{ MODES[mode].label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </PolicyField>
      <PolicyField
        label="Highest a trigger can raise it to"
        description="A shake or an error never goes past this. Set it to Off to forbid triggers."
        :overridden="overridden('ceiling')"
        :inherited-from="props.inheritedFrom"
        for="policy-ceiling"
        @reset="reset('ceiling')"
      >
        <Select :model-value="modeOf('ceiling')" @update:model-value="set('ceiling', $event)">
          <SelectTrigger id="policy-ceiling" class="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="mode in RECORDING_MODES" :key="mode" :value="mode">
              {{ MODES[mode].label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </PolicyField>
      <PolicyField
        label="Devices sampled"
        description="The share of devices that run the mode. The others still answer triggers. A device with its own rule is always sampled."
        :overridden="overridden('sampleRate')"
        :inherited-from="props.inheritedFrom"
        @reset="reset('sampleRate')"
      >
        <div class="flex w-56 items-center gap-3">
          <Slider
            :model-value="[Math.round(num('sampleRate') * 100)]"
            :min="0"
            :max="100"
            :step="5"
            aria-label="Devices sampled"
            @update:model-value="$event && set('sampleRate', ($event[0] ?? 0) / 100)"
          />
          <span class="tabular w-10 text-right text-sm"
            >{{ Math.round(num("sampleRate") * 100) }}%</span
          >
        </div>
      </PolicyField>
    </section>

    <section class="space-y-1 py-4">
      <h3 class="text-sm font-semibold">What it captures</h3>
      <PolicyField
        v-for="track in TRACKS"
        :key="track.key"
        :label="track.label"
        :description="track.description"
        :overridden="overridden(`tracks.${track.key}`)"
        :inherited-from="props.inheritedFrom"
        :for="`policy-track-${track.key}`"
        @reset="reset(`tracks.${track.key}`)"
      >
        <Switch
          :id="`policy-track-${track.key}`"
          :model-value="bool(`tracks.${track.key}`)"
          @update:model-value="set(`tracks.${track.key}`, $event)"
        />
      </PolicyField>
      <PolicyField
        v-if="bool('tracks.network')"
        label="Request and response bodies"
        description="Textual bodies only, cut at the size below. They often hold what went wrong, and what is private."
        :overridden="overridden('network.bodies')"
        :inherited-from="props.inheritedFrom"
        for="policy-bodies"
        @reset="reset('network.bodies')"
      >
        <Switch
          id="policy-bodies"
          :model-value="bool('network.bodies')"
          @update:model-value="set('network.bodies', $event)"
        />
      </PolicyField>
      <PolicyField
        v-if="bool('tracks.network') && bool('network.bodies')"
        label="Largest body kept"
        :overridden="overridden('network.maxBodyBytes')"
        :inherited-from="props.inheritedFrom"
        for="policy-body-size"
        @reset="reset('network.maxBodyBytes')"
      >
        <UnitInput
          id="policy-body-size"
          :model-value="num('network.maxBodyBytes')"
          :factor="1024"
          unit="KB"
          :min="limits.maxBodyBytes.min"
          :max="limits.maxBodyBytes.max"
          @update:model-value="set('network.maxBodyBytes', $event)"
        />
      </PolicyField>
      <PolicyField
        v-if="bool('tracks.database')"
        label="Tables"
        description="Every table, or only these. A table without a primary key is never captured."
        :overridden="overridden('database.tables')"
        :inherited-from="props.inheritedFrom"
        @reset="reset('database.tables')"
      >
        <div class="flex w-72 flex-col items-end gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            :model-value="tables === 'all' ? 'all' : 'some'"
            @update:model-value="
              $event === 'all'
                ? set('database.tables', 'all')
                : $event && set('database.tables', [])
            "
          >
            <ToggleGroupItem value="all">All tables</ToggleGroupItem>
            <ToggleGroupItem value="some">Only some</ToggleGroupItem>
          </ToggleGroup>
          <TagsInput
            v-if="tables !== 'all'"
            :model-value="tables"
            class="w-full"
            @update:model-value="set('database.tables', $event)"
          >
            <TagsInputItem v-for="table in tables" :key="table" :value="table">
              <TagsInputItemText class="font-mono" />
              <TagsInputItemDelete />
            </TagsInputItem>
            <TagsInputInput placeholder="orders, order_lines…" />
          </TagsInput>
        </div>
      </PolicyField>
    </section>

    <section class="space-y-1 py-4">
      <h3 class="text-sm font-semibold">What raises it</h3>
      <PolicyField
        label="Triggers"
        description="Each raises the device to a session for the post-roll below, keeping what was buffered."
        :overridden="overridden('triggers')"
        :inherited-from="props.inheritedFrom"
        @reset="reset('triggers')"
      >
        <div class="grid w-72 grid-cols-2 gap-2">
          <label
            v-for="trigger in TRIGGERS"
            :key="trigger.key"
            :title="trigger.description"
            :class="
              cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                triggers.includes(trigger.key) && 'border-primary/50 bg-primary/5',
              )
            "
          >
            <Checkbox
              :model-value="triggers.includes(trigger.key)"
              @update:model-value="toggleTrigger(trigger.key, $event === true)"
            />
            {{ trigger.label }}
          </label>
        </div>
      </PolicyField>
      <PolicyField
        label="Keep recording after a trigger"
        :overridden="overridden('postRollMs')"
        :inherited-from="props.inheritedFrom"
        for="policy-postroll"
        @reset="reset('postRollMs')"
      >
        <UnitInput
          id="policy-postroll"
          :model-value="num('postRollMs')"
          :factor="MINUTE"
          unit="min"
          :step="0.5"
          :min="limits.postRollMs.min"
          :max="limits.postRollMs.max"
          @update:model-value="set('postRollMs', $event)"
        />
      </PolicyField>
      <PolicyField
        label="Buffer length"
        description="How far back a trigger can see."
        :overridden="overridden('buffer.maxMs')"
        :inherited-from="props.inheritedFrom"
        for="policy-buffer-time"
        @reset="reset('buffer.maxMs')"
      >
        <UnitInput
          id="policy-buffer-time"
          :model-value="num('buffer.maxMs')"
          :factor="MINUTE"
          unit="min"
          :min="limits.bufferMs.min"
          :max="limits.bufferMs.max"
          @update:model-value="set('buffer.maxMs', $event)"
        />
      </PolicyField>
      <PolicyField
        label="Buffer size on the device"
        :overridden="overridden('buffer.maxBytes')"
        :inherited-from="props.inheritedFrom"
        for="policy-buffer-size"
        @reset="reset('buffer.maxBytes')"
      >
        <UnitInput
          id="policy-buffer-size"
          :model-value="num('buffer.maxBytes')"
          :factor="MB"
          unit="MB"
          :min="limits.bufferBytes.min"
          :max="limits.bufferBytes.max"
          @update:model-value="set('buffer.maxBytes', $event)"
        />
      </PolicyField>
    </section>

    <section class="space-y-1 pt-4">
      <h3 class="text-sm font-semibold">Delivery</h3>
      <PolicyField
        label="Upload every"
        description="In session mode. Shorter means fresher data and more requests."
        :overridden="overridden('flushMs')"
        :inherited-from="props.inheritedFrom"
        for="policy-flush"
        @reset="reset('flushMs')"
      >
        <UnitInput
          id="policy-flush"
          :model-value="num('flushMs')"
          :factor="1000"
          unit="s"
          :min="limits.flushMs.min"
          :max="limits.flushMs.max"
          @update:model-value="set('flushMs', $event)"
        />
      </PolicyField>
      <PolicyField
        label="Longest session"
        description="A longer recording is split into consecutive sessions."
        :overridden="overridden('maxSessionMs')"
        :inherited-from="props.inheritedFrom"
        for="policy-max-session"
        @reset="reset('maxSessionMs')"
      >
        <UnitInput
          id="policy-max-session"
          :model-value="num('maxSessionMs')"
          :factor="MINUTE"
          unit="min"
          :min="limits.maxSessionMs.min"
          :max="limits.maxSessionMs.max"
          @update:model-value="set('maxSessionMs', $event)"
        />
      </PolicyField>
      <PolicyField
        label="Upload on Wi-Fi only"
        description="Segments wait on the device until it is on Wi-Fi."
        :overridden="overridden('wifiOnly')"
        :inherited-from="props.inheritedFrom"
        for="policy-wifi"
        @reset="reset('wifiOnly')"
      >
        <Switch
          id="policy-wifi"
          :model-value="bool('wifiOnly')"
          @update:model-value="set('wifiOnly', $event)"
        />
      </PolicyField>
      <PolicyField
        label="Check for new rules every"
        description="Also on every return to the foreground. Going live waits for this check."
        :overridden="overridden('pollMs')"
        :inherited-from="props.inheritedFrom"
        for="policy-poll"
        @reset="reset('pollMs')"
      >
        <UnitInput
          id="policy-poll"
          :model-value="num('pollMs')"
          :factor="MINUTE"
          unit="min"
          :step="0.25"
          :min="limits.pollMs.min"
          :max="limits.pollMs.max"
          @update:model-value="set('pollMs', $event)"
        />
      </PolicyField>
    </section>
  </div>
</template>
