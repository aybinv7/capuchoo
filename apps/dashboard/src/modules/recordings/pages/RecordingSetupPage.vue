<script setup lang="ts">
import { SlidersHorizontal } from "@lucide/vue";
import { useStorage } from "@vueuse/core";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { RouteName } from "@/shared/router/route-names";
import CodeSnippet from "../components/setup/CodeSnippet.vue";
import IntegrationCheck from "../components/setup/IntegrationCheck.vue";
import SetupStep from "../components/setup/SetupStep.vue";
import { useRecorderHealth } from "../composables/useRecorderHealth";
import { useRecordingRules } from "../composables/useRecordingRules";
import {
  SETUP_ENGINES,
  captureSnippet,
  extrasSnippet,
  installSnippet,
  mainSnippet,
  pluginSnippet,
  workerSnippet,
  type SetupEngine,
} from "../lib/setup-snippets";

const { appId } = useCurrentApp();
const health = useRecorderHealth(appId);
const rules = useRecordingRules(appId);

const engine = useStorage<SetupEngine>("capuchoo.recording.setup-engine", "cavulsqa");
const engineDetail = computed(
  () => SETUP_ENGINES.find((candidate) => candidate.id === engine.value)?.detail ?? "",
);
const plugin = computed(() => pluginSnippet(engine.value));

const reports = computed(() => health.devices.value.map((device) => device.health));
const reporting = computed(() => reports.value.some((report) => report !== null));
const threaded = computed(() => reports.value.some((report) => report?.threaded));
const capturing = computed(() =>
  reports.value.some((report) =>
    report?.databases.some((db) => db.state === "changesets" || db.state === "rows"),
  ),
);

const appRule = computed(
  () => rules.query.data.value?.rules.find((rule) => rule.scope === "app") ?? null,
);
const appMode = computed(
  () => appRule.value?.policy.mode ?? rules.query.data.value?.defaults.mode ?? "off",
);

function bufferEverywhere() {
  rules.save.mutate({ scope: "app", policy: { ...appRule.value?.policy, mode: "buffer" } });
}

function pickEngine(value: unknown) {
  if (SETUP_ENGINES.some((candidate) => candidate.id === value))
    engine.value = value as SetupEngine;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Connect an app"
      description="Five steps, about ten minutes. Each one is checked against what your devices actually report, so you know it works before anyone needs a recording."
    >
      <template #actions>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: RouteName.recordingRules }">
            <SlidersHorizontal />
            What devices record
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ol class="min-w-0">
        <SetupStep
          :index="1"
          title="Install the recorder"
          description="It reads the updater's identity, so a session lines up with the device's update checks."
          :done="reporting"
        >
          <CodeSnippet :snippet="installSnippet" />
        </SetupStep>

        <SetupStep
          :index="2"
          title="Give it a worker"
          description="Serialization, gzip, OPFS writes and uploads run here. The thread that renders only hands over plain objects."
          :done="threaded"
        >
          <CodeSnippet :snippet="workerSnippet" />
        </SetupStep>

        <SetupStep
          :index="3"
          title="Create the recorder"
          description="Pick how the app stores its data; the snippet wires the database the way that engine records best."
          :done="engine === 'none' ? reporting : capturing"
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            :model-value="engine"
            class="flex-wrap"
            aria-label="Database engine"
            @update:model-value="pickEngine"
          >
            <ToggleGroupItem
              v-for="candidate in SETUP_ENGINES"
              :key="candidate.id"
              :value="candidate.id"
              class="px-3 text-xs"
            >
              {{ candidate.label }}
            </ToggleGroupItem>
          </ToggleGroup>
          <p class="text-muted-foreground text-xs text-pretty">{{ engineDetail }}</p>
          <CodeSnippet :snippet="plugin" />
          <CodeSnippet v-if="engine === 'cavulsqa'" :snippet="captureSnippet" />
        </SetupStep>

        <SetupStep
          :index="4"
          title="Start it before anything else"
          description="The recorder waits for the database on its own. Started first, it records a boot that never gets past opening it - the crash nobody can reproduce."
          :done="reporting"
        >
          <CodeSnippet :snippet="mainSnippet" />
        </SetupStep>

        <SetupStep
          :index="5"
          title="Turn it on"
          description="Recording is off until a rule says otherwise. Buffer keeps the last minutes on each device and uploads nothing until a shake, an error or a report asks for them."
          :done="appMode !== 'off'"
          last
        >
          <div class="flex flex-wrap items-center gap-3">
            <Button
              v-if="appMode === 'off'"
              size="sm"
              :disabled="rules.save.isPending.value || rules.query.isPending.value"
              @click="bufferEverywhere"
            >
              Buffer on every device
            </Button>
            <p v-else class="text-sm">
              Devices record in <span class="font-mono font-medium">{{ appMode }}</span> mode.
            </p>
            <RouterLink
              :to="{ name: RouteName.recordingRules }"
              class="text-primary text-sm underline-offset-4 hover:underline"
            >
              Per channel and per device rules
            </RouterLink>
          </div>
          <details class="group text-sm">
            <summary class="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
              Navigation, escalation and telemetry from app code
            </summary>
            <div class="mt-3">
              <CodeSnippet :snippet="extrasSnippet" />
            </div>
          </details>
        </SetupStep>
      </ol>

      <aside class="lg:sticky lg:top-4 lg:h-[calc(100svh-6rem)] lg:self-start">
        <IntegrationCheck
          :devices="health.devices.value"
          :loading="health.query.isPending.value"
          :error="health.query.error.value"
          :retry="health.query.refetch"
        />
      </aside>
    </div>
  </PageContainer>
</template>
