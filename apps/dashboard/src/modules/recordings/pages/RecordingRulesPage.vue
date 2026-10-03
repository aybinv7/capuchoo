<script setup lang="ts">
import type { RecordingPolicy, RecordingPolicyPatch } from "@capuchoo/core";
import { AppWindow, RadioTower, Smartphone } from "@lucide/vue";
import { useQueries } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/shared/queries/useCatalog";
import DevicePicker from "../components/rules/DevicePicker.vue";
import GoLiveButton from "../components/rules/GoLiveButton.vue";
import PolicyEditor from "../components/rules/PolicyEditor.vue";
import { useRecordingRules } from "../composables/useRecordingRules";
import { mergePolicy, samePatch } from "../lib/policy-form";
import { formatScope, parseScope, ruleFor, type ScopeKey } from "../lib/scopes";
import { fetchDeviceLabel, type DeviceOption } from "../services/recordings.service";

const { appId } = useCurrentApp();
const { channels } = useCatalog(appId);
const { query, save, remove } = useRecordingRules(appId);

const scopeParam = useQueryParam<string>("scope", "app");
const selected = computed(() => parseScope(scopeParam.value));
const rules = computed(() => query.data.value?.rules ?? []);
const defaults = computed(() => query.data.value?.defaults ?? null);

const picked = ref<DeviceOption[]>([]);
const deviceRules = computed(() => rules.value.filter((rule) => rule.scope === "device"));
const deviceIds = computed(() => [
  ...new Set([
    ...deviceRules.value.map((rule) => rule.device_uuid!),
    ...picked.value.map((device) => device.id),
  ]),
]);
const labels = useQueries({
  queries: computed(() =>
    deviceIds.value.map((id) => ({
      queryKey: ["recording-device-label", id] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchDeviceLabel(id, signal),
      staleTime: 5 * 60_000,
    })),
  ),
});
const deviceLabel = (id: string) => {
  const index = deviceIds.value.indexOf(id);
  return (
    labels.value[index]?.data ??
    picked.value.find((device) => device.id === id)?.label ??
    `${id.slice(0, 8)}…`
  );
};

const appPatch = computed<RecordingPolicyPatch>(
  () => ruleFor(rules.value, { scope: "app", id: null })?.policy ?? {},
);
const base = computed<RecordingPolicy | null>(() => {
  if (!defaults.value) return null;
  return selected.value.scope === "app"
    ? defaults.value
    : mergePolicy(defaults.value, appPatch.value);
});
const inheritedFrom = computed(() => (selected.value.scope === "app" ? "the defaults" : "the app"));

const rule = computed(() => ruleFor(rules.value, selected.value));
const saved = computed<RecordingPolicyPatch>(() => rule.value?.policy ?? {});
const draft = ref<RecordingPolicyPatch>({});

/** Query data arrives as reactive proxies, which structuredClone refuses; a patch is plain JSON. */
const copyPatch = (patch: RecordingPolicyPatch): RecordingPolicyPatch =>
  JSON.parse(JSON.stringify(patch)) as RecordingPolicyPatch;
const dirty = computed(() => !samePatch(draft.value, saved.value));

watch(
  [selected, saved],
  () => {
    draft.value = copyPatch(saved.value);
  },
  { immediate: true, deep: true },
);

function choose(key: ScopeKey) {
  scopeParam.value = formatScope(key);
}

function addDevice(device: DeviceOption) {
  if (!picked.value.some((entry) => entry.id === device.id)) picked.value.push(device);
  choose({ scope: "device", id: device.id });
}

function commit() {
  save.mutate({
    scope: selected.value.scope,
    channelId: selected.value.scope === "channel" ? selected.value.id : null,
    deviceId: selected.value.scope === "device" ? selected.value.id : null,
    policy: draft.value,
  });
}

function discard() {
  draft.value = copyPatch(saved.value);
}

function dropRule() {
  if (rule.value) remove.mutate(rule.value.id);
}

const overrides = (patch: RecordingPolicyPatch | undefined) => Object.keys(patch ?? {}).length;
const scopeTitle = computed(() => {
  const key = selected.value;
  if (key.scope === "app") return "Every device of the app";
  if (key.scope === "channel") {
    return `Devices on ${channels.value.find((channel) => channel.id === key.id)?.name ?? "this channel"}`;
  }
  return deviceLabel(key.id!);
});
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="What devices record"
      description="Rules apply from the app down: a channel overrides the app, a device overrides its channel. An open app picks up a change within a second; others when they next start or come to the foreground."
    />

    <ErrorNotice
      v-if="query.error.value && !query.data.value"
      :error="query.error.value"
      :retry="query.refetch"
    />
    <div v-else-if="!base" class="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Skeleton class="h-80" />
      <Skeleton class="h-[32rem]" />
    </div>
    <div v-else class="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav class="space-y-5 lg:sticky lg:top-20" aria-label="Rule scopes">
        <button
          type="button"
          :class="
            cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
              selected.scope === 'app' ? 'bg-accent font-medium' : 'hover:bg-accent/60',
            )
          "
          @click="choose({ scope: 'app', id: null })"
        >
          <AppWindow class="text-muted-foreground size-4" aria-hidden="true" />
          <span class="flex-1">App</span>
          <span v-if="overrides(appPatch)" class="text-muted-foreground tabular text-xs">{{
            overrides(appPatch)
          }}</span>
        </button>

        <div class="space-y-1">
          <h3 class="text-muted-foreground px-2.5 text-[11px] font-medium tracking-wide uppercase">
            Channels
          </h3>
          <button
            v-for="channel in channels"
            :key="channel.id"
            type="button"
            :class="
              cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
                selected.scope === 'channel' && selected.id === channel.id
                  ? 'bg-accent font-medium'
                  : 'hover:bg-accent/60',
              )
            "
            @click="choose({ scope: 'channel', id: channel.id })"
          >
            <RadioTower class="text-muted-foreground size-4" aria-hidden="true" />
            <span class="flex-1 truncate font-mono text-xs">{{ channel.name }}</span>
            <EnvBadge :environment="channel.environment" size="sm" />
            <span
              v-if="ruleFor(rules, { scope: 'channel', id: channel.id })"
              class="bg-primary size-1.5 rounded-full"
              aria-label="Has its own rule"
            />
          </button>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between px-2.5">
            <h3 class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Devices
            </h3>
            <DevicePicker :app-id="appId" @pick="addDevice" />
          </div>
          <p v-if="deviceIds.length === 0" class="text-muted-foreground px-2.5 text-xs text-pretty">
            Give one device its own rule to record it, or watch it live, without touching the rest.
          </p>
          <button
            v-for="id in deviceIds"
            :key="id"
            type="button"
            :class="
              cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
                selected.scope === 'device' && selected.id === id
                  ? 'bg-accent font-medium'
                  : 'hover:bg-accent/60',
              )
            "
            @click="choose({ scope: 'device', id })"
          >
            <Smartphone class="text-muted-foreground size-4" aria-hidden="true" />
            <span class="flex-1 truncate">{{ deviceLabel(id) }}</span>
            <span
              v-if="ruleFor(rules, { scope: 'device', id })?.live_until"
              class="bg-destructive size-1.5 animate-pulse rounded-full"
              aria-label="Live"
            />
          </button>
        </div>
      </nav>

      <section class="bg-card rounded-xl border">
        <header class="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <div class="min-w-0 flex-1">
            <h2 class="truncate font-semibold">{{ scopeTitle }}</h2>
            <p class="text-muted-foreground text-xs">
              {{
                rule
                  ? `${overrides(saved)} ${overrides(saved) === 1 ? "setting" : "settings"} set here; the rest from ${inheritedFrom}.`
                  : `No rule of its own yet: everything comes from ${inheritedFrom}.`
              }}
            </p>
          </div>
          <GoLiveButton
            v-if="selected.scope === 'device' && selected.id"
            :app-id="appId"
            :device-id="selected.id"
          />
          <Button
            v-if="rule && selected.scope !== 'app'"
            variant="ghost"
            size="sm"
            :disabled="remove.isPending.value"
            @click="dropRule"
          >
            Remove this rule
          </Button>
        </header>
        <div class="px-5 pb-2">
          <PolicyEditor v-model="draft" :base="base" :inherited-from="inheritedFrom" />
        </div>
        <footer
          v-if="dirty"
          class="bg-card/95 sticky bottom-0 flex items-center justify-end gap-2 rounded-b-xl border-t px-5 py-3 backdrop-blur"
        >
          <span class="text-muted-foreground mr-auto text-sm">Unsaved changes</span>
          <Button variant="ghost" size="sm" @click="discard">Discard</Button>
          <Button size="sm" :disabled="save.isPending.value" @click="commit">Save rule</Button>
        </footer>
      </section>
    </div>
  </PageContainer>
</template>
