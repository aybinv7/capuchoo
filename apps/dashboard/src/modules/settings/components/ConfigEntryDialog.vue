<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { ENVIRONMENT_ORDER } from "@/shared/lib/channels";
import type { Channel } from "@/shared/types/release";
import type { useRemoteConfig } from "../composables/useRemoteConfig";
import { CONFIG_KEY_PATTERN, configValueProblem } from "../lib/config-value";
import type { ConfigEntry, ConfigInput } from "../types/settings.types";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  entry: ConfigEntry | null;
  channels: readonly Channel[];
  save: ReturnType<typeof useRemoteConfig>["save"];
}>();

const form = ref<ConfigInput>({
  key: "",
  value: "",
  value_type: "string",
  environment: "all",
  channel: null,
});

watch(open, (value) => {
  if (!value) return;
  props.save.reset();
  const entry = props.entry;
  form.value = entry
    ? {
        key: entry.key,
        value: entry.value,
        value_type: entry.value_type,
        environment: entry.environment,
        channel: entry.channel,
      }
    : { key: "", value: "", value_type: "string", environment: "all", channel: null };
});

const keyProblem = computed(() =>
  form.value.key && !CONFIG_KEY_PATTERN.test(form.value.key)
    ? "Letters, digits, _ . - and no leading digit."
    : null,
);
const valueProblem = computed(() => configValueProblem(form.value.value, form.value.value_type));
const ready = computed(
  () =>
    Boolean(form.value.key) &&
    !keyProblem.value &&
    !valueProblem.value &&
    !props.save.isPending.value,
);

function setChannel(value: unknown) {
  form.value = { ...form.value, channel: typeof value === "string" && value ? value : null };
}

function submit() {
  if (!ready.value) return;
  props.save.mutate(
    { ...form.value },
    {
      onSuccess: (entry) => {
        toast.success(`${entry.key} saved`);
        open.value = false;
      },
    },
  );
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          props.entry ? `Edit ${props.entry.key}` : "New config value"
        }}</DialogTitle>
        <DialogDescription>
          Devices receive it with their update response. A channel value overrides an environment
          value, which overrides one for all.
        </DialogDescription>
      </DialogHeader>
      <form id="config-entry" novalidate @submit.prevent="submit">
        <FieldGroup class="gap-4">
          <Field :data-invalid="keyProblem ? true : undefined">
            <FieldLabel for="config-key">Key</FieldLabel>
            <Input
              id="config-key"
              v-model="form.key"
              class="font-mono"
              maxlength="128"
              :readonly="Boolean(props.entry)"
              spellcheck="false"
            />
            <FieldError v-if="keyProblem">{{ keyProblem }}</FieldError>
          </Field>
          <div class="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel for="config-type">Type</FieldLabel>
              <NativeSelect id="config-type" v-model="form.value_type">
                <NativeSelectOption value="string">string</NativeSelectOption>
                <NativeSelectOption value="number">number</NativeSelectOption>
                <NativeSelectOption value="boolean">boolean</NativeSelectOption>
                <NativeSelectOption value="json">json</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel for="config-env">Environment</FieldLabel>
              <NativeSelect
                id="config-env"
                v-model="form.environment"
                :disabled="Boolean(props.entry)"
              >
                <NativeSelectOption value="all">all</NativeSelectOption>
                <NativeSelectOption v-for="env in ENVIRONMENT_ORDER" :key="env" :value="env">{{
                  env
                }}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel for="config-channel">Channel</FieldLabel>
              <NativeSelect
                id="config-channel"
                :model-value="form.channel ?? ''"
                :disabled="Boolean(props.entry)"
                @update:model-value="setChannel"
              >
                <NativeSelectOption value="">any</NativeSelectOption>
                <NativeSelectOption
                  v-for="channel in props.channels"
                  :key="channel.id"
                  :value="channel.name"
                  >{{ channel.name }}</NativeSelectOption
                >
              </NativeSelect>
            </Field>
          </div>
          <Field :data-invalid="valueProblem ? true : undefined">
            <FieldLabel for="config-value">Value</FieldLabel>
            <Textarea
              id="config-value"
              v-model="form.value"
              :rows="form.value_type === 'json' ? 6 : 2"
              class="font-mono text-xs"
              spellcheck="false"
            />
            <FieldDescription v-if="props.entry">
              Key, environment and channel identify the entry; change the value or the type.
            </FieldDescription>
            <FieldError v-if="valueProblem">{{ valueProblem }}</FieldError>
          </Field>
          <ErrorNotice v-if="props.save.error.value" :error="props.save.error.value" />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button type="submit" form="config-entry" :disabled="!ready">
          <Spinner v-if="props.save.isPending.value" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
