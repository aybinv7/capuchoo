<script setup lang="ts">
import { Bug, Clapperboard, Headset } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import StartBadge from "@/shared/components/recording/StartBadge.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { formatSpan } from "@/shared/lib/format";
import { useLatestSessions } from "@/shared/queries/useLatestSessions";
import { RouteName } from "@/shared/router/route-names";

const props = defineProps<{ appId: string; deviceId: string; deviceName: string }>();

const permissions = useAppPermissions();
const { data, isPending } = useLatestSessions(() => props.appId, {
  deviceId: () => props.deviceId,
  limit: 4,
});
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header
      class="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase"
    >
      <Clapperboard class="size-3.5" aria-hidden="true" />
      Sessions
      <RouterLink
        :to="{ name: RouteName.recordings, query: { device: props.deviceId } }"
        class="text-primary ml-auto normal-case hover:underline"
        >All sessions</RouterLink
      >
    </header>
    <div class="p-3">
      <div v-if="isPending" class="space-y-2" aria-busy="true">
        <Skeleton v-for="index in 3" :key="index" class="h-9 w-full" />
      </div>
      <p v-else-if="!data?.length" class="text-muted-foreground py-3 text-sm">
        This device has not recorded a session in the last 14 days.
      </p>
      <ol v-else class="-mx-2">
        <li v-for="session in data" :key="session.id">
          <RouterLink
            :to="{ name: RouteName.recording, params: { recordingId: session.id } }"
            class="hover:bg-accent/50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs"
          >
            <StartBadge :start="session.start" />
            <span class="flex min-w-0 items-center gap-1.5">
              <StatusDot v-if="session.live" tone="danger" pulse />
              <span class="truncate">{{ session.note ?? formatSpan(session.duration_ms) }}</span>
              <span
                v-if="session.error_count > 0"
                class="text-destructive tabular flex shrink-0 items-center gap-0.5"
              >
                <Bug class="size-3" />{{ session.error_count }}
              </span>
            </span>
            <RelativeTime :value="session.started_at" class="text-muted-foreground text-[11px]" />
          </RouterLink>
        </li>
      </ol>
      <Button
        v-if="permissions.assist.value"
        variant="outline"
        size="sm"
        class="mt-3 w-full"
        as-child
      >
        <RouterLink
          :to="{
            name: RouteName.recordingAssist,
            params: { deviceId: props.deviceId },
            query: { name: props.deviceName },
          }"
        >
          <Headset />
          Assist this device
        </RouterLink>
      </Button>
    </div>
  </section>
</template>
