<script setup lang="ts">
import { Radio, Square } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatClock } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { LIVE_DURATIONS, useDeviceLive } from "../../composables/useDeviceLive";
import { useLiveSession } from "../../composables/useLiveSession";
import type { RecordingSession } from "../../types/recordings.types";

const props = defineProps<{ appId: string; session: RecordingSession }>();

const router = useRouter();
const deviceId = computed(() => props.session.device_uuid ?? null);
const { liveUntil, goLive, pending } = useDeviceLive(() => props.appId, deviceId);
const elsewhere = useLiveSession(
  () => props.appId,
  deviceId,
  () => Boolean(liveUntil.value) && !props.session.live,
);
const stream = computed(() =>
  elsewhere.value && elsewhere.value.id !== props.session.id ? elsewhere.value : null,
);

/** Set when the live window was opened from this player, which then follows the device into it. */
const requested = ref(false);

function start(minutes: number) {
  requested.value = true;
  goLive(minutes);
}

function stop() {
  requested.value = false;
  goLive(null);
}

function watchStream(id: string) {
  void router.push({ name: RouteName.recording, params: { recordingId: id } });
}

watch(stream, (found) => {
  if (!found || !requested.value) return;
  requested.value = false;
  watchStream(found.id);
});
</script>

<template>
  <template v-if="deviceId">
    <Button
      v-if="stream"
      size="sm"
      class="bg-destructive hover:bg-destructive/90 text-white"
      @click="watchStream(stream.id)"
    >
      <span class="relative flex size-2">
        <span class="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
        <span class="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      Watch live
    </Button>

    <DropdownMenu v-else-if="liveUntil">
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" class="text-destructive" :disabled="pending">
          <Spinner v-if="!props.session.live" class="size-3.5" />
          <span v-else class="bg-destructive size-2 rounded-full" aria-hidden="true" />
          {{ props.session.live ? "Live" : "Waiting for the app" }}
          <span class="text-muted-foreground hidden font-normal xl:inline"
            >· until {{ formatClock(liveUntil, false) }}</span
          >
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-64">
        <DropdownMenuLabel class="text-muted-foreground text-xs font-normal text-pretty">
          {{
            props.session.live
              ? "This device is streaming. It stops at the end of the window, or now."
              : "The device streams as soon as the app is open and in the foreground."
          }}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem class="text-destructive" @select="stop">
          <Square class="fill-current" />
          Stop live
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu v-else-if="!props.session.live">
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" :disabled="pending">
          <Radio />
          Go live
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-64">
        <DropdownMenuLabel class="text-muted-foreground text-xs font-normal text-pretty">
          Stream this device now. The player opens the live session as soon as it starts.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem v-for="minutes in LIVE_DURATIONS" :key="minutes" @select="start(minutes)">
          For {{ minutes }} minutes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </template>
</template>
