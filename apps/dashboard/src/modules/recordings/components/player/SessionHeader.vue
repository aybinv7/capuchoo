<script setup lang="ts">
import {
  ArrowLeft,
  Columns2,
  Ellipsis,
  FileText,
  Link,
  MessageSquareQuote,
  Monitor,
  Share2,
  Smartphone,
  Table2,
  Trash2,
} from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CopyButton from "@/shared/components/CopyButton.vue";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { formatBytes, formatCount, formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../../lib/activity";
import { sessionDeviceLabel } from "../../lib/recording-columns";
import type { RecordingSession } from "../../types/recordings.types";
import StartBadge from "../StartBadge.vue";

export type PlayerView = "screen" | "data" | "both";

const props = defineProps<{ session: RecordingSession; time: number }>();
const emit = defineEmits<{ remove: []; copyLink: []; copyReport: [] }>();
const view = defineModel<PlayerView>("view", { required: true });

const VIEWS: Array<{ value: PlayerView; label: string; icon: typeof Monitor; key: string }> = [
  { value: "screen", label: "Screen", icon: Monitor, key: "S" },
  { value: "both", label: "Both", icon: Columns2, key: "B" },
  { value: "data", label: "Data", icon: Table2, key: "D" },
];

const screen = computed(() => {
  const value = props.session.device?.screen;
  return value ? `${value.width}×${value.height} @${value.dpr}x` : null;
});
const facts = computed(() =>
  [
    formatDateTime(props.session.started_at),
    formatOffset(props.session.duration_ms),
    `${formatCount(props.session.event_count)} events`,
    formatBytes(props.session.size_bytes),
    props.session.device?.osVersion ? `OS ${props.session.device.osVersion}` : null,
    props.session.device?.webview ? `WebView ${props.session.device.webview}` : null,
    screen.value,
  ].filter(Boolean),
);
</script>

<template>
  <header class="space-y-3">
    <div class="flex flex-wrap items-start gap-3">
      <Button variant="ghost" size="icon-sm" class="mt-0.5" as-child>
        <RouterLink :to="{ name: RouteName.recordings }" aria-label="Back to recordings">
          <ArrowLeft />
        </RouterLink>
      </Button>
      <div class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
        <PlatformIcon :platform="props.session.platform" class="size-5" />
      </div>
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-lg font-semibold tracking-tight">
            {{ sessionDeviceLabel(props.session) }}
          </h1>
          <StartBadge :start="props.session.start" />
          <VersionTag kind="ota" :version="props.session.version_name" />
          <span
            v-if="props.session.channel"
            class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]"
            >{{ props.session.channel }}</span
          >
          <span
            v-if="props.session.error_count > 0"
            class="bg-danger-soft text-destructive rounded-full px-2 py-0.5 text-[11px] font-medium"
            >{{ props.session.error_count }}
            {{ props.session.error_count === 1 ? "error" : "errors" }}</span
          >
        </div>
        <p class="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          <template v-for="(fact, index) in facts" :key="index">
            <span v-if="index > 0" aria-hidden="true">·</span>
            <span class="tabular">{{ fact }}</span>
          </template>
        </p>
      </div>
      <div class="flex items-center gap-1">
        <ToggleGroup
          v-model="view"
          type="single"
          variant="outline"
          size="sm"
          class="mr-1"
          aria-label="What the player shows"
        >
          <Tooltip v-for="option in VIEWS" :key="option.value">
            <TooltipTrigger as-child>
              <ToggleGroupItem :value="option.value" :aria-label="option.label" class="px-2.5">
                <component :is="option.icon" />
                <span class="hidden xl:inline">{{ option.label }}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{{ option.label }} · {{ option.key }}</TooltipContent>
          </Tooltip>
        </ToggleGroup>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">
              <Share2 />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-64">
            <DropdownMenuItem @select="emit('copyLink')">
              <Link />
              Copy link at {{ formatOffset(props.time) }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('copyReport')">
              <FileText />
              Copy bug report (Markdown)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button v-if="props.session.device_uuid" variant="outline" size="sm" as-child>
          <RouterLink
            :to="{ name: RouteName.device, params: { deviceId: props.session.device_uuid } }"
          >
            <Smartphone />
            Device
          </RouterLink>
        </Button>
        <CopyButton :value="props.session.device_id" label="Copy device id" />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem as-child>
              <RouterLink
                v-if="props.session.device_uuid"
                :to="{ name: RouteName.recordings, query: { device: props.session.device_uuid } }"
                >Other sessions from this device</RouterLink
              >
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive" @select="emit('remove')">
              <Trash2 />
              Delete recording
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <blockquote
      v-if="props.session.note"
      class="border-primary/60 bg-primary/5 flex gap-2 rounded-r-md border-l-2 px-3 py-2 text-sm text-pretty"
    >
      <MessageSquareQuote class="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span dir="auto">{{ props.session.note }}</span>
    </blockquote>
  </header>
</template>
