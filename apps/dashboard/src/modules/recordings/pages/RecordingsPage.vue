<script setup lang="ts">
import { Clapperboard, SlidersHorizontal, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { RouteName } from "@/shared/router/route-names";
import RecordingsTable from "../components/RecordingsTable.vue";
import GoLiveButton from "../components/rules/GoLiveButton.vue";
import { useRecordings } from "../composables/useRecordings";
import { START_KINDS, startStyle } from "../lib/start";
import type { RecordingFilters, RecordingSession } from "../types/recordings.types";

const router = useRouter();
const { appId, app } = useCurrentApp();

const device = useQueryParam<string>("device", "");
const errorsOnly = useQueryParam<"" | "1">("errors", "", (value): value is "1" => value === "1");
const start = useQueryParam<string>("start", "");
const search = ref("");

const filters = computed<RecordingFilters>(() => ({
  deviceId: device.value || null,
  version: null,
  errors: errorsOnly.value === "1",
  start: start.value || null,
}));

const { query, sessions } = useRecordings(appId, filters);
const visible = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (!needle) return sessions.value;
  return sessions.value.filter((session) =>
    [session.device_id, session.note, session.version_name, session.device?.model, session.channel]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
});
const filtered = computed(() => Boolean(device.value || errorsOnly.value || start.value));
const nothingYet = computed(
  () => !query.isPending.value && sessions.value.length === 0 && !filtered.value,
);

function open(session: RecordingSession) {
  void router.push({ name: RouteName.recording, params: { recordingId: session.id } });
}

function clearFilters() {
  device.value = "";
  errorsOnly.value = "";
  start.value = "";
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Recordings"
      description="What happened on a device: the screen, its console and network, and every database write, on one timeline. Devices record only what the rules ask for."
    >
      <template #actions>
        <GoLiveButton v-if="device" :app-id="appId" :device-id="device" />
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: RouteName.recordingRules }">
            <SlidersHorizontal />
            What devices record
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorNotice
      v-if="query.error.value && !query.data.value"
      :error="query.error.value"
      :retry="query.refetch"
    />
    <EmptyState
      v-else-if="nothingYet"
      :icon="Clapperboard"
      title="No recordings yet"
      description="Recording is off until a rule turns it on. Set the app to buffer, and a shake, an error or a report from any device uploads what led up to it."
    >
      <Button size="sm" as-child>
        <RouterLink :to="{ name: RouteName.recordingRules }">Set up recording</RouterLink>
      </Button>
    </EmptyState>
    <RecordingsTable
      v-else
      v-model:search="search"
      :sessions="visible"
      :has-more="Boolean(query.hasNextPage.value)"
      :loading="query.isPending.value"
      :loading-more="query.isFetchingNextPage.value"
      :refreshing="query.isRefetching.value"
      :app-name="app?.name ?? 'app'"
      @open="open"
      @load-more="query.fetchNextPage()"
      @refresh="query.refetch()"
    >
      <template #toolbar>
        <Toggle
          size="sm"
          variant="outline"
          :model-value="errorsOnly === '1'"
          aria-label="Only sessions with errors"
          @update:model-value="errorsOnly = $event ? '1' : ''"
        >
          With errors
        </Toggle>
        <Select
          :model-value="start || 'any'"
          @update:model-value="start = $event === 'any' ? '' : String($event)"
        >
          <SelectTrigger size="sm" class="w-36" aria-label="Started by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any start</SelectItem>
            <SelectItem v-for="kind in START_KINDS" :key="kind" :value="kind">
              {{ startStyle(kind).label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button v-if="filtered" variant="ghost" size="sm" @click="clearFilters">
          <X />
          {{ device ? "All devices" : "Clear" }}
        </Button>
      </template>
      <template #empty>
        <p class="text-muted-foreground py-10 text-center text-sm">
          No session matches these filters.
        </p>
      </template>
    </RecordingsTable>
  </PageContainer>
</template>
