<script setup lang="ts">
import {
  ArrowLeft,
  Ellipsis,
  FileText,
  FlaskConical,
  History,
  Link,
  MessageSquareQuote,
  Share2,
  Smartphone,
  Trash2,
} from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../../lib/activity";
import { sessionDeviceLabel } from "../../lib/recording-columns";
import type { RecordingSession } from "../../types/recordings.types";
import AssistButton from "./AssistButton.vue";
import PlayerLiveControl from "./PlayerLiveControl.vue";
import SessionFacts from "./SessionFacts.vue";

const props = defineProps<{ appId: string; session: RecordingSession; time: number }>();
const emit = defineEmits<{ remove: []; copyLink: []; copyReport: []; exportTest: [] }>();
</script>

<template>
  <header class="flex h-10 min-w-0 items-center gap-1">
    <Button variant="ghost" size="icon-sm" class="shrink-0" as-child>
      <RouterLink :to="{ name: RouteName.recordings }" aria-label="Back to recordings">
        <ArrowLeft />
      </RouterLink>
    </Button>

    <div class="flex min-w-0 items-center gap-2 pl-1">
      <PlatformIcon
        :platform="props.session.platform"
        class="text-muted-foreground size-4 shrink-0"
      />
      <h1 class="min-w-0 truncate text-sm font-semibold tracking-tight md:text-base">
        <RouterLink
          v-if="props.session.device_uuid"
          :to="{ name: RouteName.device, params: { deviceId: props.session.device_uuid } }"
          class="decoration-muted-foreground/50 underline-offset-4 hover:underline"
          title="Open the device"
          >{{ sessionDeviceLabel(props.session) }}</RouterLink
        >
        <template v-else>{{ sessionDeviceLabel(props.session) }}</template>
      </h1>
    </div>

    <SessionFacts :session="props.session" class="hidden min-w-0 sm:flex" />

    <span
      v-if="props.session.error_count > 0"
      class="bg-danger-soft text-destructive shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      >{{ props.session.error_count }}
      {{ props.session.error_count === 1 ? "error" : "errors" }}</span
    >

    <Popover v-if="props.session.note">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10 ml-1 flex h-7 max-w-[32ch] min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs"
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

    <div class="ml-auto flex shrink-0 items-center gap-2 pl-2">
      <AssistButton
        v-if="props.session.device_uuid"
        :device-id="props.session.device_uuid"
        :device-name="sessionDeviceLabel(props.session)"
      />
      <PlayerLiveControl :app-id="props.appId" :session="props.session" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm">
            <Share2 />
            <span class="hidden md:inline">Share</span>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="emit('exportTest')">
            <FlaskConical />
            Export as a test
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon-sm" aria-label="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <template v-if="props.session.device_uuid">
            <DropdownMenuItem as-child>
              <RouterLink
                :to="{ name: RouteName.device, params: { deviceId: props.session.device_uuid } }"
              >
                <Smartphone />
                Open the device
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <RouterLink
                :to="{ name: RouteName.recordings, query: { device: props.session.device_uuid } }"
              >
                <History />
                Other sessions from this device
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem class="text-destructive" @select="emit('remove')">
            <Trash2 />
            Delete recording
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
