<script setup lang="ts">
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { VersionMode } from "../lib/run-form";

const mode = defineModel<VersionMode>("mode", { required: true });
const version = defineModel<string>("version", { required: true });

const props = defineProps<{
  /** Deliver pins an exact version, so the other modes are not offered. */
  exactOnly: boolean;
  suggestion: string | null;
  error: string | null;
}>();

const emit = defineEmits<{ edited: [] }>();

const HINTS: Record<VersionMode, string> = {
  ref: "The workflow picks the version for the ref, exactly as on a push.",
  auto: "Bumps the patch of the latest release on the channel.",
  exact: "Publishes or delivers exactly this version.",
};

function setMode(value: unknown) {
  if (value === "ref" || value === "auto" || value === "exact") mode.value = value;
}

function useSuggestion() {
  if (!props.suggestion) return;
  version.value = props.suggestion;
  emit("edited");
}
</script>

<template>
  <Field :data-invalid="Boolean(props.error) || undefined">
    <FieldLabel for="run-version">Version</FieldLabel>
    <div class="flex flex-wrap items-center gap-2">
      <ToggleGroup
        v-if="!props.exactOnly"
        :model-value="mode"
        type="single"
        variant="outline"
        size="sm"
        aria-label="Version"
        @update:model-value="setMode"
      >
        <ToggleGroupItem value="ref">From ref</ToggleGroupItem>
        <ToggleGroupItem value="auto">Auto bump</ToggleGroupItem>
        <ToggleGroupItem value="exact">Exact</ToggleGroupItem>
      </ToggleGroup>
      <Input
        v-if="props.exactOnly || mode === 'exact'"
        id="run-version"
        v-model="version"
        class="h-8 w-36 font-mono"
        placeholder="1.4.2"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="Boolean(props.error) || undefined"
        @input="emit('edited')"
      />
      <Button
        v-if="
          props.suggestion && version !== props.suggestion && (props.exactOnly || mode === 'exact')
        "
        variant="ghost"
        size="xs"
        @click="useSuggestion"
      >
        Use <span class="font-mono">{{ props.suggestion }}</span>
      </Button>
    </div>
    <FieldError v-if="props.error">{{ props.error }}</FieldError>
    <FieldDescription v-else>{{
      props.exactOnly
        ? "The version the client should run. It must already be on prod."
        : HINTS[mode]
    }}</FieldDescription>
  </Field>
</template>
