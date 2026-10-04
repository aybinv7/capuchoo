<script setup lang="ts">
import { Clapperboard, Package } from "@lucide/vue";
import { computed, ref } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import SessionStats from "../components/SessionStats.vue";
import UpdateStats from "../components/UpdateStats.vue";
import {
  SESSION_WINDOWS,
  STAT_WINDOWS,
  type SessionWindow,
  type StatWindow,
} from "../types/statistics.types";

type View = "updates" | "sessions";

const { appId } = useCurrentApp();
const view = useQueryParam<View>(
  "view",
  "updates",
  (value): value is View => value === "updates" || value === "sessions",
);
const updateDays = ref<StatWindow>(30);
const sessionDays = ref<SessionWindow>(14);
const busy = ref(false);

const windows = computed<readonly number[]>(() =>
  view.value === "sessions" ? SESSION_WINDOWS : STAT_WINDOWS,
);
const days = computed(() => (view.value === "sessions" ? sessionDays.value : updateDays.value));

const DESCRIPTION: Record<View, string> = {
  updates:
    "Update checks, installs and failures reported by devices, and how far each channel's fleet has moved to its current bundle.",
  sessions:
    "What the recorder captured: how many sessions, how many broke, which versions break most, and the errors behind them. Recordings are kept 14 days.",
};

function setDays(value: unknown) {
  const next = Number(value);
  if (view.value === "sessions") {
    if ((SESSION_WINDOWS as readonly number[]).includes(next)) {
      sessionDays.value = next as SessionWindow;
    }
  } else if ((STAT_WINDOWS as readonly number[]).includes(next)) {
    updateDays.value = next as StatWindow;
  }
}

function setView(value: string | number) {
  view.value = value === "sessions" ? "sessions" : "updates";
  busy.value = false;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader title="Statistics" :description="DESCRIPTION[view]">
      <template #actions>
        <ToggleGroup
          :model-value="String(days)"
          type="single"
          variant="outline"
          size="sm"
          :class="busy && 'opacity-70'"
          @update:model-value="setDays"
        >
          <ToggleGroupItem v-for="span in windows" :key="span" :value="String(span)"
            >{{ span }} days</ToggleGroupItem
          >
        </ToggleGroup>
      </template>
    </PageHeader>

    <Tabs :model-value="view" class="gap-6" @update:model-value="setView">
      <TabsList>
        <TabsTrigger value="updates">
          <Package />
          Updates
        </TabsTrigger>
        <TabsTrigger value="sessions">
          <Clapperboard />
          Sessions
        </TabsTrigger>
      </TabsList>
      <TabsContent value="updates">
        <UpdateStats :app-id="appId" :days="updateDays" @busy="busy = $event" />
      </TabsContent>
      <TabsContent value="sessions">
        <SessionStats :app-id="appId" :days="sessionDays" @busy="busy = $event" />
      </TabsContent>
    </Tabs>
  </PageContainer>
</template>
