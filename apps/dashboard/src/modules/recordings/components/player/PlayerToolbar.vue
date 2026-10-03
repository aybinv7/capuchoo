<script setup lang="ts">
import {
  ArrowLeft,
  Copy,
  Ellipsis,
  FileText,
  Info,
  Link,
  MessageSquareQuote,
  PanelRightClose,
  PanelRightOpen,
  Share2,
  Smartphone,
  Trash2,
} from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { formatBytes, formatCount, formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../../lib/activity";
import { sessionDeviceLabel } from "../../lib/recording-columns";
import type { RecordingSession } from "../../types/recordings.types";
import StartBadge from "../StartBadge.vue";

const props = defineProps<{ session: RecordingSession; time: number }>();
const emit = defineEmits<{ remove: []; copyLink: []; copyReport: [] }>();
/** Whether the inspector sits beside the screen; off gives the screen the whole width. */
const panel = defineModel<boolean>("panel", { required: true });

const { copy } = useClipboard({ legacy: true });

const facts = computed(() => {
  const session = props.session;
  const screen = session.device?.screen;
  return [
    ["Started", formatDateTime(session.started_at)],
    ["Length", formatOffset(session.duration_ms)],
    ["Events", formatCount(session.event_count)],
    ["Size", formatBytes(session.size_bytes)],
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
  <header class="flex h-10 min-w-0 items-center gap-2">
    <Button variant="ghost" size="icon-sm" as-child>
      <RouterLink :to="{ name: RouteName.recordings }" aria-label="Back to recordings">
        <ArrowLeft />
      </RouterLink>
    </Button>
    <PlatformIcon :platform="props.session.platform" class="text-muted-foreground size-4" />
    <h1 class="min-w-0 truncate text-sm font-semibold tracking-tight md:text-base">
      {{ sessionDeviceLabel(props.session) }}
    </h1>
    <StartBadge :start="props.session.start" class="hidden sm:inline-flex" />
    <VersionTag kind="ota" :version="props.session.version_name" class="hidden md:inline-flex" />
    <span
      v-if="props.session.channel"
      class="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[11px] md:inline"
      >{{ props.session.channel }}</span
    >
    <span
      v-if="props.session.error_count > 0"
      class="bg-danger-soft text-destructive shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      >{{ props.session.error_count }}
      {{ props.session.error_count === 1 ? "error" : "errors" }}</span
    >

    <HoverCard :open-delay="150">
      <HoverCardTrigger as-child>
        <Button variant="ghost" size="icon-sm" aria-label="Session details">
          <Info />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="start" class="w-80">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
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
              aria-label="Copy device id"
              @click="copy(props.session.device_id)"
            >
              <Copy />
            </Button>
          </dd>
        </dl>
      </HoverCardContent>
    </HoverCard>

    <Popover v-if="props.session.note">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10 flex h-7 max-w-[32ch] min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs"
          :title="props.session.note"
        >
          <MessageSquareQuote class="text-primary size-3.5 shrink-0" aria-hidden="true" />
          <span class="truncate" dir="auto">{{ props.session.note }}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" class="w-96">
        <p class="text-sm text-pretty whitespace-pre-wrap" dir="auto">{{ props.session.note }}</p>
      </PopoverContent>
    </Popover>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-pressed="panel"
            :aria-label="panel ? 'Give the screen the whole width' : 'Show the inspector'"
            @click="panel = !panel"
          >
            <PanelRightClose v-if="panel" />
            <PanelRightOpen v-else />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          >{{ panel ? "Hide the inspector" : "Show the inspector" }} · S</TooltipContent
        >
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="h-8">
            <Share2 />
            <span class="hidden lg:inline">Share</span>
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
      <Button v-if="props.session.device_uuid" variant="outline" size="sm" class="h-8" as-child>
        <RouterLink
          :to="{ name: RouteName.device, params: { deviceId: props.session.device_uuid } }"
          aria-label="Open the device"
        >
          <Smartphone />
          <span class="hidden lg:inline">Device</span>
        </RouterLink>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem v-if="props.session.device_uuid" as-child>
            <RouterLink
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
  </header>
</template>
