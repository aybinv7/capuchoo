<script setup lang="ts">
import { CircleSlash, Headset, RotateCcw, Smartphone } from "@lucide/vue";
import { useIntervalFn } from "@vueuse/core";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AssistOutcome, AssistPhase } from "../../types/assist.types";

const props = defineProps<{
  phase: AssistPhase;
  /** Whether the screen is showing; the card steps aside once it is. */
  showing: boolean;
  inviteExpiresAt: string | null;
  outcome: AssistOutcome | null;
}>();
const emit = defineEmits<{ again: [] }>();

const now = ref(Date.now());
useIntervalFn(() => (now.value = Date.now()), 1000);
const remaining = computed(() => {
  if (!props.inviteExpiresAt) return null;
  return Math.max(0, Math.round((Date.parse(props.inviteExpiresAt) - now.value) / 1000));
});
</script>

<template>
  <div
    v-if="props.phase !== 'live' || !props.showing"
    class="bg-card/95 absolute inset-0 m-auto flex h-fit w-[min(360px,calc(100%-2rem))] flex-col items-center gap-3 rounded-2xl border p-6 text-center shadow-lg backdrop-blur"
    role="status"
  >
    <template v-if="props.phase === 'starting'">
      <Spinner class="size-6" />
      <p class="font-medium">Asking the device</p>
    </template>

    <template v-else-if="props.phase === 'waiting'">
      <span
        class="bg-primary/10 text-primary relative flex size-12 items-center justify-center rounded-full"
      >
        <Smartphone class="size-6" aria-hidden="true" />
        <span class="border-primary/40 absolute inset-0 animate-ping rounded-full border" />
      </span>
      <p class="font-medium">Waiting for the user to accept</p>
      <p class="text-muted-foreground text-sm text-pretty">
        They see your request on their phone if the app is open. Nothing is shared until they
        accept.
      </p>
      <p v-if="remaining !== null" class="text-muted-foreground tabular text-xs">
        The request lapses in {{ remaining }} s
      </p>
    </template>

    <template v-else-if="props.phase === 'live'">
      <Spinner class="size-6" />
      <p class="font-medium">Receiving the screen</p>
    </template>

    <template v-else>
      <span
        class="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full"
      >
        <CircleSlash v-if="props.outcome?.reason !== 'agent'" class="size-6" aria-hidden="true" />
        <Headset v-else class="size-6" aria-hidden="true" />
      </span>
      <p class="font-medium">Session over</p>
      <p class="text-muted-foreground text-sm text-pretty">{{ props.outcome?.message }}</p>
      <Button size="sm" class="mt-1" @click="emit('again')">
        <RotateCcw />
        Ask again
      </Button>
    </template>
  </div>
</template>
