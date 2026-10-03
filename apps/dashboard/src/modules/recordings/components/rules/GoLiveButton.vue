<script setup lang="ts">
import { Radio, Square } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatClock } from "@/shared/lib/format";
import { LIVE_DURATIONS, useDeviceLive } from "../../composables/useDeviceLive";

const props = defineProps<{ appId: string; deviceId: string }>();

const { liveUntil, goLive, pending } = useDeviceLive(
  () => props.appId,
  () => props.deviceId,
);
</script>

<template>
  <Button
    v-if="liveUntil"
    variant="outline"
    size="sm"
    class="border-destructive/40 text-destructive"
    :disabled="pending"
    @click="goLive(null)"
  >
    <Square class="fill-current" />
    Live until {{ formatClock(liveUntil, false) }}
  </Button>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" :disabled="pending">
        <Radio />
        Go live
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60">
      <DropdownMenuLabel class="text-muted-foreground text-xs font-normal text-pretty">
        The device starts streaming within a second if the app is open, or as soon as it is opened
        next.
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-for="minutes in LIVE_DURATIONS" :key="minutes" @select="goLive(minutes)">
        For {{ minutes }} minutes
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
