<script setup lang="ts">
import { computed, onScopeDispose } from "vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import { useNow } from "@/shared/composables/useNow";
import { devicePresence, PRESENCE_TONE } from "../lib/presence";

const props = defineProps<{ lastSeenAt: string | null | undefined }>();

const clock = useNow();
onScopeDispose(clock.release);

const presence = computed(() => devicePresence(props.lastSeenAt, clock.now.value));
</script>

<template>
  <span
    class="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-normal"
    role="status"
  >
    <StatusDot :tone="PRESENCE_TONE[presence]" :pulse="presence === 'online'" />
    <span v-if="presence === 'online'" class="text-foreground">Online</span>
    <span v-else-if="presence === 'unknown'">Never seen</span>
    <span v-else>Seen <RelativeTime :value="props.lastSeenAt" /></span>
  </span>
</template>
