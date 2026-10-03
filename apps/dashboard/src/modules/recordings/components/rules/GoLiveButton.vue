<script setup lang="ts">
import { Radio, Square } from "@lucide/vue";
import { computed, onScopeDispose } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNow } from "@/shared/composables/useNow";
import { formatClock } from "@/shared/lib/format";
import { useRecordingRules } from "../../composables/useRecordingRules";

const props = defineProps<{ appId: string; deviceId: string }>();

const DURATIONS = [5, 15, 30, 60];

const { query, save } = useRecordingRules(() => props.appId);
const clock = useNow();
onScopeDispose(clock.release);
const rule = computed(
  () =>
    query.data.value?.rules.find(
      (candidate) => candidate.scope === "device" && candidate.device_uuid === props.deviceId,
    ) ?? null,
);
const liveUntil = computed(() => {
  const until = rule.value?.live_until;
  return until && new Date(until).getTime() > clock.now.value ? until : null;
});

function goLive(minutes: number | null) {
  save.mutate({ scope: "device", deviceId: props.deviceId, liveMinutes: minutes });
}
</script>

<template>
  <Button
    v-if="liveUntil"
    variant="outline"
    size="sm"
    class="border-destructive/40 text-destructive"
    :disabled="save.isPending.value"
    @click="goLive(null)"
  >
    <Square class="fill-current" />
    Live until {{ formatClock(liveUntil, false) }}
  </Button>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" :disabled="save.isPending.value">
        <Radio />
        Go live
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60">
      <DropdownMenuLabel class="text-muted-foreground text-xs font-normal text-pretty">
        The device streams every second while it is open. It notices at its next policy check.
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-for="minutes in DURATIONS" :key="minutes" @select="goLive(minutes)">
        For {{ minutes }} minutes
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
