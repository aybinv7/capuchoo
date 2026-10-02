<script setup lang="ts">
import { Play } from "@lucide/vue";
import { computed } from "vue";
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
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ErrorNotice from "../../components/ErrorNotice.vue";
import ProviderIcon from "../../components/ProviderIcon.vue";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useAppCi } from "../../queries/useAppCi";
import { useRunForm } from "../composables/useRunForm";
import { runActionInfo } from "../lib/run-actions";
import type { RunPreset } from "../lib/run-form";
import RefCombobox from "./RefCombobox.vue";
import RunActionPicker from "./RunActionPicker.vue";
import RunVersionField from "./RunVersionField.vue";

const open = defineModel<boolean>("open", { required: true });
const props = withDefaults(defineProps<{ preset?: RunPreset }>(), { preset: () => ({}) });

const { appId } = useCurrentApp();
const { ci } = useAppCi(appId);
const run = useRunForm(appId, open, () => props.preset);
const form = run.form;

const target = computed(() => {
  const value = ci.value;
  if (value?.provider === "github" && value.github) return value.github.repository.full_name;
  if (value?.provider === "gitlab") return value.gitlab?.project ?? "GitLab project";
  return null;
});
const detail = computed(() => runActionInfo(form.action).detail);
const pending = computed(() => run.start.isPending.value);
const generalError = computed(() =>
  run.start.error.value && !run.serverField.value ? run.start.error.value : null,
);

const channelHint = computed(() => {
  if (!form.channel)
    return "The workflow maps the ref to a channel, as on a push. Capuchoo treats that as a prod run, so it needs the prod delivery role.";
  if (form.channel === run.derivedChannel.value) return `Where a push to ${form.ref} publishes.`;
  return `Publishes ${form.ref || "the ref"} to ${form.channel}, whichever branch it is.`;
});

function setBuildType(value: unknown) {
  if (value === "release" || value === "debug") form.buildType = value;
}

function submit() {
  run.submit(() => {
    open.value = false;
  });
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Play class="size-4" />
          Run pipeline
        </DialogTitle>
        <DialogDescription class="flex flex-wrap items-center gap-1.5">
          <template v-if="target">
            Starts the Capuchoo workflow on
            <span class="text-foreground inline-flex items-center gap-1 font-mono text-xs">
              <ProviderIcon :provider="ci?.provider" class="size-3" />{{ target }}
            </span>
          </template>
          <template v-else>Starts the Capuchoo workflow in the connected repository.</template>
        </DialogDescription>
      </DialogHeader>

      <form id="run-pipeline" novalidate class="space-y-5" @submit.prevent="submit">
        <section class="space-y-2">
          <RunActionPicker v-model="form.action" />
          <p class="text-muted-foreground text-xs text-pretty">{{ detail }}</p>
        </section>

        <FieldGroup class="gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <Field :data-invalid="Boolean(run.errorFor('ref')) || undefined">
              <FieldLabel for="run-ref">Ref</FieldLabel>
              <RefCombobox
                id="run-ref"
                v-model="form.ref"
                :refs="run.refList.value"
                :loading="run.refs.isFetching.value"
                :invalid="Boolean(run.errorFor('ref'))"
              />
              <FieldError v-if="run.errorFor('ref')">{{ run.errorFor("ref") }}</FieldError>
              <FieldDescription v-else-if="run.refs.error.value">
                Branches could not be listed; type the ref instead.
              </FieldDescription>
            </Field>

            <Field
              v-if="form.action === 'deliver'"
              :data-invalid="Boolean(run.errorFor('client')) || undefined"
            >
              <FieldLabel for="run-client">Client</FieldLabel>
              <NativeSelect
                id="run-client"
                v-model="form.client"
                :aria-invalid="Boolean(run.errorFor('client')) || undefined"
              >
                <NativeSelectOption value="" disabled>Pick a client channel</NativeSelectOption>
                <NativeSelectOption
                  v-for="channel in run.clients.value"
                  :key="channel.id"
                  :value="channel.name"
                  >{{ channel.name }}</NativeSelectOption
                >
              </NativeSelect>
              <FieldError v-if="run.errorFor('client')">{{ run.errorFor("client") }}</FieldError>
              <FieldDescription v-else-if="run.clients.value.length === 0">
                This app has no client channels yet.
              </FieldDescription>
            </Field>

            <Field v-else :data-invalid="Boolean(run.errorFor('channel')) || undefined">
              <FieldLabel for="run-channel">Channel</FieldLabel>
              <NativeSelect
                id="run-channel"
                v-model="form.channel"
                :aria-invalid="Boolean(run.errorFor('channel')) || undefined"
                @change="run.markChannelEdited"
              >
                <NativeSelectOption value="">Derive from the ref</NativeSelectOption>
                <NativeSelectOptGroup
                  v-for="group in run.channelGroups.value"
                  :key="group.environment"
                  :label="group.environment"
                >
                  <NativeSelectOption
                    v-for="channel in group.channels"
                    :key="channel.id"
                    :value="channel.name"
                    >{{ channel.name }}</NativeSelectOption
                  >
                </NativeSelectOptGroup>
              </NativeSelect>
              <FieldError v-if="run.errorFor('channel')">{{ run.errorFor("channel") }}</FieldError>
              <FieldDescription v-else>{{ channelHint }}</FieldDescription>
            </Field>
          </div>

          <RunVersionField
            v-model:mode="form.versionMode"
            v-model:version="form.version"
            :exact-only="form.action === 'deliver'"
            :suggestion="run.deliverSuggestion.value"
            :error="run.errorFor('version')"
            @edited="run.markVersionEdited"
          />

          <Field v-if="form.action === 'native'">
            <FieldLabel>Build type</FieldLabel>
            <ToggleGroup
              :model-value="form.buildType"
              type="single"
              variant="outline"
              size="sm"
              class="w-fit"
              aria-label="Build type"
              @update:model-value="setBuildType"
            >
              <ToggleGroupItem value="release">Release</ToggleGroupItem>
              <ToggleGroupItem value="debug">Debug</ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              {{
                form.buildType === "release"
                  ? "Signed with the repository's Android keystore."
                  : "Debug-signed; installs only where debug builds are allowed."
              }}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel for="run-notes"
              >Release notes
              <span class="text-muted-foreground font-normal">(optional)</span></FieldLabel
            >
            <Textarea
              id="run-notes"
              v-model="form.notes"
              rows="2"
              maxlength="500"
              placeholder="What changed, ticket, incident…"
            />
          </Field>
        </FieldGroup>

        <ErrorNotice v-if="generalError" :error="generalError" />
      </form>

      <DialogFooter class="items-center gap-3 sm:justify-between">
        <p class="text-muted-foreground min-w-0 truncate font-mono text-xs" aria-live="polite">
          {{ run.summary.value ?? "" }}
        </p>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" :disabled="pending" @click="open = false">Cancel</Button>
          <Button type="submit" form="run-pipeline" :disabled="pending">
            <Spinner v-if="pending" />
            <Play v-else />
            Run
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
