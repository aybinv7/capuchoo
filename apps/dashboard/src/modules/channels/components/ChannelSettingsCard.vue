<script setup lang="ts">
import type { Environment } from "@capuchoo/core";
import { Lock } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { errorMessage, errorTitle, isApiError } from "@/shared/api/errors";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { ENVIRONMENT_ORDER, clientsOf } from "@/shared/lib/channels";
import { RouteName } from "@/shared/router/route-names";
import type { Channel, ChannelHistoryEntry } from "@/shared/types/release";
import { useChannelMutations } from "../composables/useChannelMutations";
import { DELIVERY_FLAGS, hasServed } from "../lib/channel-flags";
import type { ChannelFlag } from "../types/channels.types";

const props = defineProps<{
  channel: Channel;
  channels: readonly Channel[];
  history: readonly ChannelHistoryEntry[];
}>();

const permissions = useAppPermissions();
const { update } = useChannelMutations(() => props.channel.app_id);

const gate = computed(() => permissions.manageChannels.value);
const pendingFlag = ref<ChannelFlag | null>(null);
const environmentError = ref<unknown>(null);
const environmentKey = ref(0);

const base = computed(() =>
  props.channels.find((entry) => entry.id === props.channel.base_channel_id),
);
const environmentLock = computed(() => {
  if (props.channel.kind === "client") return "A client channel serves its base's environment.";
  if (hasServed(props.history))
    return "This channel has served releases, so its environment is fixed. Create a new channel instead.";
  if (clientsOf(props.channel, props.channels).length > 0)
    return "Client channels follow this one, so its environment is fixed.";
  return null;
});

function setFlag(flag: ChannelFlag, value: boolean) {
  pendingFlag.value = flag;
  update.mutate(
    { channelId: props.channel.id, patch: { [flag]: value } },
    {
      onError: (error) => toast.error(errorTitle(error), { description: errorMessage(error) }),
      onSettled: () => {
        pendingFlag.value = null;
      },
    },
  );
}

function setEnvironment(value: unknown) {
  const environment = value as Environment;
  if (environment === props.channel.environment) return;
  environmentError.value = null;
  update.mutate(
    { channelId: props.channel.id, patch: { environment } },
    {
      onSuccess: () => toast.success(`${props.channel.name} now serves ${environment}`),
      onError: (error) => {
        environmentError.value = error;
        environmentKey.value += 1;
      },
    },
  );
}

const lockedByServer = computed(
  () =>
    isApiError(environmentError.value) && environmentError.value.reason === "environment_locked",
);
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header class="flex items-center justify-between border-b px-4 py-2.5">
      <span class="text-muted-foreground text-xs font-medium uppercase">Delivery settings</span>
      <span
        v-if="!gate.ok"
        class="text-muted-foreground flex items-center gap-1 text-xs"
        :title="gate.reason"
      >
        <Lock class="size-3" />
        read only
      </span>
    </header>
    <div class="divide-y">
      <div class="grid grid-cols-[8rem_1fr] items-center gap-2 px-4 py-3 text-sm">
        <span class="text-muted-foreground">Kind</span>
        <span>
          {{ props.channel.kind === "client" ? "Client channel" : "Release channel" }}
          <template v-if="base">
            following
            <RouterLink
              :to="{ name: RouteName.channel, params: { channelId: base.id } }"
              class="font-mono hover:underline"
              >{{ base.name }}</RouterLink
            >
          </template>
        </span>
        <span class="text-muted-foreground">Environment</span>
        <div class="flex items-center gap-2">
          <EnvBadge v-if="environmentLock || !gate.ok" :environment="props.channel.environment" />
          <NativeSelect
            v-else
            :key="environmentKey"
            :model-value="props.channel.environment"
            class="h-8 w-36"
            :disabled="update.isPending.value"
            @update:model-value="setEnvironment"
          >
            <NativeSelectOption v-for="env in ENVIRONMENT_ORDER" :key="env" :value="env">{{
              env
            }}</NativeSelectOption>
          </NativeSelect>
        </div>
        <p v-if="environmentLock" class="text-muted-foreground col-span-2 text-xs">
          {{ environmentLock }}
        </p>
      </div>
      <div v-if="environmentError" class="px-4 py-3">
        <ErrorNotice :error="environmentError" />
        <p v-if="lockedByServer" class="text-muted-foreground mt-2 text-xs">
          The server keeps the environment of a channel that has delivered, so devices never cross
          environments.
        </p>
      </div>
      <Field
        v-for="flag in DELIVERY_FLAGS"
        :key="flag.key"
        orientation="horizontal"
        class="px-4 py-3"
      >
        <FieldContent>
          <FieldLabel :for="`flag-${flag.key}`">{{ flag.label }}</FieldLabel>
          <FieldDescription class="text-xs">{{ flag.description }}</FieldDescription>
        </FieldContent>
        <Switch
          :id="`flag-${flag.key}`"
          :model-value="props.channel[flag.key]"
          :disabled="!gate.ok || pendingFlag !== null"
          @update:model-value="setFlag(flag.key, $event)"
        />
      </Field>
    </div>
  </section>
</template>
