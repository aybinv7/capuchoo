<script setup lang="ts">
import { Download, FlaskConical, TriangleAlert } from "@lucide/vue";
import { computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import CopyButton from "@/shared/components/CopyButton.vue";
import { useTestExport } from "../../composables/useTestExport";
import { formatOffset } from "../../lib/activity";
import { EXPORT_FORMATS, FORMATS } from "../../lib/test-export/formats";
import type { Lanes, RecordingSession } from "../../types/recordings.types";

const props = defineProps<{
  appId: string;
  session: RecordingSession;
  lanes: Lanes;
  bounds: { start: number; end: number };
  viewport: { width: number; height: number } | null;
  /** The playhead, in milliseconds from the session's start. */
  time: number;
}>();
const open = defineModel<boolean>("open", { required: true });

const exporter = useTestExport({
  appId: computed(() => props.appId),
  session: computed(() => props.session),
  lanes: computed(() => props.lanes),
  bounds: computed(() => props.bounds),
  viewport: computed(() => props.viewport),
});
const { format, info, complete, stubs, baseUrl, appPackage, range, length, result } = exporter;

watch(open, (value) => {
  if (value) exporter.reset();
});

const rangeModel = computed({
  get: () => [...range.value],
  set: (value: number[]) => {
    range.value = [value[0] ?? 0, value[1] ?? length.value];
  },
});
const step = computed(() => Math.max(100, Math.round(length.value / 400)));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="grid h-[min(780px,92svh)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-6xl"
    >
      <DialogHeader class="border-b px-5 py-4">
        <DialogTitle class="flex items-center gap-2">
          <FlaskConical class="text-primary size-4" aria-hidden="true" />
          Export as a test
        </DialogTitle>
        <DialogDescription>
          The user's taps, values and routes, written as a test you can run.
        </DialogDescription>
      </DialogHeader>

      <div class="grid min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
        <div class="min-h-0 space-y-6 overflow-y-auto border-b p-5 md:border-r md:border-b-0">
          <fieldset class="space-y-2">
            <legend class="mb-2 text-xs font-medium">Format</legend>
            <RadioGroup v-model="format" class="gap-1.5">
              <Label
                v-for="id in EXPORT_FORMATS"
                :key="id"
                :for="`export-${id}`"
                class="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 font-normal transition-colors"
              >
                <RadioGroupItem :id="`export-${id}`" :value="id" class="mt-0.5" />
                <span class="grid gap-0.5">
                  <span class="text-sm font-medium">{{ FORMATS[id].label }}</span>
                  <span class="text-muted-foreground text-xs leading-snug">{{
                    FORMATS[id].hint
                  }}</span>
                </span>
              </Label>
            </RadioGroup>
          </fieldset>

          <fieldset class="space-y-3">
            <legend class="mb-2 flex w-full items-baseline justify-between text-xs font-medium">
              Stretch
              <span class="text-muted-foreground tabular font-mono font-normal">
                {{ formatOffset(range[0]) }} – {{ formatOffset(range[1]) }}
              </span>
            </legend>
            <Slider
              v-model="rangeModel"
              :min="0"
              :max="length"
              :step="step"
              :min-steps-between-thumbs="1"
              aria-label="Stretch of the session to export"
            />
            <div class="flex items-center gap-1.5">
              <Button variant="outline" size="xs" @click="exporter.reset()">Whole session</Button>
              <Button variant="outline" size="xs" @click="exporter.reset(props.time)"
                >From the playhead</Button
              >
              <span class="text-muted-foreground tabular ml-auto text-xs whitespace-nowrap"
                >{{ exporter.actions.value }}
                {{ exporter.actions.value === 1 ? "step" : "steps" }}</span
              >
            </div>
          </fieldset>

          <fieldset class="space-y-4">
            <legend class="mb-2 text-xs font-medium">Options</legend>
            <div class="flex items-start justify-between gap-3">
              <Label for="export-complete" class="grid gap-0.5 font-normal">
                <span class="text-sm">Whole test file</span>
                <span class="text-muted-foreground text-xs">Off gives only the steps to paste</span>
              </Label>
              <Switch id="export-complete" v-model="complete" />
            </div>
            <div v-if="info.stubs" class="flex items-start justify-between gap-3">
              <Label for="export-stubs" class="grid gap-0.5 font-normal">
                <span class="text-sm">Recorded responses</span>
                <span class="text-muted-foreground text-xs">{{
                  exporter.hasBodies.value
                    ? "The test gets the same data the user got"
                    : "None recorded: turn on network bodies in the rules"
                }}</span>
              </Label>
              <Switch
                id="export-stubs"
                :model-value="stubs && exporter.hasBodies.value"
                :disabled="!exporter.hasBodies.value"
                @update:model-value="stubs = $event"
              />
            </div>
            <div v-if="info.baseUrl" class="grid gap-1.5">
              <Label for="export-base" class="text-sm font-normal">App served at</Label>
              <Input
                id="export-base"
                v-model="baseUrl"
                class="h-8 font-mono text-xs"
                spellcheck="false"
                placeholder="http://localhost:5173"
              />
            </div>
            <div v-if="format === 'capubridge'" class="grid gap-1.5">
              <Label for="export-package" class="text-sm font-normal">App package</Label>
              <Input
                id="export-package"
                v-model="appPackage"
                class="h-8 font-mono text-xs"
                spellcheck="false"
                placeholder="com.example.app"
              />
            </div>
          </fieldset>
        </div>

        <div class="bg-muted/30 flex min-h-0 min-w-0 flex-col">
          <div class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
            <span class="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">{{
              exporter.fileName.value
            }}</span>
            <CopyButton :value="result.code" :label="exporter.fileName.value" />
            <Button
              variant="outline"
              size="sm"
              :disabled="exporter.actions.value === 0"
              @click="exporter.download()"
            >
              <Download />
              Download
            </Button>
          </div>

          <div
            v-if="!exporter.recordsSteps.value"
            class="text-muted-foreground m-auto max-w-sm space-y-2 p-6 text-center text-sm"
          >
            <p class="text-foreground font-medium">This session has no steps</p>
            <p>
              Its recorder predates step capture. Update <code>@capuchoo/recorder</code> in the app:
              the sessions it records next can be exported.
            </p>
          </div>
          <template v-else>
            <ul
              v-if="result.warnings.length"
              class="border-warning/30 bg-warning-soft/40 space-y-1 border-b px-4 py-2.5 text-xs"
            >
              <li v-for="warning in result.warnings" :key="warning" class="flex gap-2">
                <TriangleAlert class="text-warning mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>{{ warning }}</span>
              </li>
            </ul>
            <p
              v-if="exporter.actions.value === 0"
              class="text-muted-foreground border-b px-4 py-2.5 text-xs"
            >
              The user did nothing in this stretch; widen it to include their steps.
            </p>
            <pre
              class="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed"
            ><code>{{ result.code }}</code></pre>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
