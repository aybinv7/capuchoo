<script setup lang="ts">
import type { Environment } from "@capuchoo/core";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import {
  CHANNEL_NAME_PATTERN,
  ENVIRONMENT_ORDER,
  compareReleaseChannels,
} from "@/shared/lib/channels";
import { RouteName } from "@/shared/router/route-names";
import type { Channel } from "@/shared/types/release";
import { useChannelMutations } from "../composables/useChannelMutations";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ appId: string; channels: readonly Channel[] }>();

const router = useRouter();
const { create } = useChannelMutations(() => props.appId);

const name = ref("");
const kind = ref<"release" | "client">("release");
const environment = ref<Environment>("dev");
const baseId = ref("");
const isPublic = ref(false);
const selfSet = ref(false);

const bases = computed(() =>
  props.channels.filter((channel) => channel.kind === "release").sort(compareReleaseChannels),
);

watch(open, (value) => {
  if (!value) return;
  create.reset();
  name.value = "";
  kind.value = "release";
  environment.value = "dev";
  baseId.value =
    bases.value.find((channel) => channel.environment === "prod")?.id ?? bases.value[0]?.id ?? "";
  isPublic.value = false;
  selfSet.value = false;
});

const nameProblem = computed(() =>
  name.value && !CHANNEL_NAME_PATTERN.test(name.value)
    ? "Letters, digits, . _ - only, starting with a letter or digit, 64 at most."
    : null,
);
const baseEnvironment = computed(
  () => bases.value.find((channel) => channel.id === baseId.value)?.environment ?? null,
);
const ready = computed(
  () =>
    Boolean(name.value) &&
    !nameProblem.value &&
    (kind.value === "release" || Boolean(baseId.value)) &&
    !create.isPending.value,
);

function setKind(value: unknown) {
  if (value === "release" || value === "client") kind.value = value;
}

function submit() {
  if (!ready.value) return;
  create.mutate(
    {
      name: name.value,
      kind: kind.value,
      ...(kind.value === "release"
        ? { environment: environment.value }
        : { base_channel_id: baseId.value }),
      public: isPublic.value,
      allow_device_self_set: selfSet.value,
    },
    {
      onSuccess: (channel) => {
        toast.success(`${channel.name} created`);
        open.value = false;
        void router.push({
          name: RouteName.channel,
          params: { appId: props.appId, channelId: channel.id },
        });
      },
    },
  );
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New channel</DialogTitle>
        <DialogDescription>
          A release channel takes uploads for one environment. A client channel follows a release
          channel and only serves what that base has served.
        </DialogDescription>
      </DialogHeader>
      <form id="create-channel" novalidate @submit.prevent="submit">
        <FieldGroup class="gap-4">
          <ToggleGroup
            :model-value="kind"
            type="single"
            variant="outline"
            class="w-full"
            @update:model-value="setKind"
          >
            <ToggleGroupItem value="release" class="flex-1">Release channel</ToggleGroupItem>
            <ToggleGroupItem value="client" class="flex-1" :disabled="bases.length === 0"
              >Client channel</ToggleGroupItem
            >
          </ToggleGroup>

          <Field :data-invalid="nameProblem ? true : undefined">
            <FieldLabel for="channel-name">Name</FieldLabel>
            <Input
              id="channel-name"
              v-model="name"
              class="font-mono"
              :placeholder="kind === 'client' ? 'prod-acme' : 'beta'"
              autocomplete="off"
              spellcheck="false"
            />
            <FieldError v-if="nameProblem">{{ nameProblem }}</FieldError>
          </Field>

          <Field v-if="kind === 'release'">
            <FieldLabel for="channel-env">Environment</FieldLabel>
            <NativeSelect id="channel-env" v-model="environment">
              <NativeSelectOption v-for="env in ENVIRONMENT_ORDER" :key="env" :value="env">{{
                env
              }}</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>Fixed once the channel has served a release.</FieldDescription>
          </Field>
          <Field v-else>
            <FieldLabel for="channel-base">Follows</FieldLabel>
            <NativeSelect id="channel-base" v-model="baseId">
              <NativeSelectOption v-for="base in bases" :key="base.id" :value="base.id"
                >{{ base.name }} ({{ base.environment }})</NativeSelectOption
              >
            </NativeSelect>
            <FieldDescription v-if="baseEnvironment">
              Serves the {{ baseEnvironment }} environment, like its base.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="channel-public">Public</FieldLabel>
              <FieldDescription>Devices that name no channel may land here.</FieldDescription>
            </FieldContent>
            <Switch id="channel-public" v-model="isPublic" />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="channel-self">Devices may select it</FieldLabel>
              <FieldDescription
                >Allows a device to switch itself onto this channel.</FieldDescription
              >
            </FieldContent>
            <Switch id="channel-self" v-model="selfSet" />
          </Field>

          <ErrorNotice v-if="create.error.value" :error="create.error.value" />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button type="submit" form="create-channel" :disabled="!ready">
          <Spinner v-if="create.isPending.value" />
          Create channel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
