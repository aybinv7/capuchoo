<script setup lang="ts">
import { Copy } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { computed, type HTMLAttributes } from "vue";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { formatBytes, formatCount, formatDateTime } from "@/shared/lib/format";
import { formatOffset } from "../../lib/activity";
import { startStyle } from "@/shared/recording/start";
import { TONE_TEXT } from "@/shared/lib/tone-styles";
import type { RecordingSession } from "../../types/recordings.types";

const props = defineProps<{ session: RecordingSession; class?: HTMLAttributes["class"] }>();

const { copy, copied } = useClipboard({ legacy: true });

const start = computed(() => startStyle(props.session.start));

/** The few facts that tell sessions apart, read in one line; the rest wait in the card. */
const summary = computed(() =>
  [
    props.session.version_name,
    props.session.channel,
    formatOffset(props.session.duration_ms),
  ].filter((part): part is string => Boolean(part)),
);

const facts = computed(() => {
  const session = props.session;
  const screen = session.device?.screen;
  return [
    ["Started", formatDateTime(session.started_at)],
    ["Because", start.value.description],
    ["Length", formatOffset(session.duration_ms)],
    ["Bundle", session.version_name],
    ["Channel", session.channel],
    ["Events", formatCount(session.event_count)],
    ["Size", formatBytes(session.size_bytes)],
    [
      "Data rate",
      session.duration_ms > 0
        ? `${formatBytes(Math.round((session.size_bytes / session.duration_ms) * 60_000))}/min`
        : null,
    ],
    [
      "System",
      session.device?.osVersion
        ? `${session.platform === "ios" ? "iOS" : "Android"} ${session.device.osVersion}`
        : null,
    ],
    ["WebView", session.device?.webview ?? null],
    ["Screen", screen ? `${screen.width}×${screen.height} @${screen.dpr}x` : null],
    ["Recorder", session.recorder],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
});
</script>

<template>
  <HoverCard :open-delay="200">
    <HoverCardTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            'text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors',
            props.class,
          )
        "
        aria-label="Session details"
      >
        <component
          :is="start.icon"
          class="size-3.5 shrink-0"
          :class="TONE_TEXT[start.tone]"
          aria-hidden="true"
        />
        <span class="shrink-0">{{ start.label }}</span>
        <template v-for="part in summary" :key="part">
          <span class="opacity-40" aria-hidden="true">·</span>
          <span class="tabular truncate font-mono">{{ part }}</span>
        </template>
      </button>
    </HoverCardTrigger>
    <HoverCardContent align="start" class="w-80">
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
        <template v-for="[label, value] in facts" :key="label">
          <dt class="text-muted-foreground">{{ label }}</dt>
          <dd class="tabular truncate font-medium" :title="value">{{ value }}</dd>
        </template>
        <dt class="text-muted-foreground">Device</dt>
        <dd class="flex min-w-0 items-center gap-1">
          <span class="truncate font-mono text-[11px]" :title="props.session.device_id">{{
            props.session.device_id
          }}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            :aria-label="copied ? 'Copied' : 'Copy device id'"
            @click="copy(props.session.device_id)"
          >
            <Copy />
          </Button>
        </dd>
      </dl>
    </HoverCardContent>
  </HoverCard>
</template>
