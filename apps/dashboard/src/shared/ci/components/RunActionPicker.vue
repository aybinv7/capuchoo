<script setup lang="ts">
import type { CiRunAction } from "@capuchoo/core";
import { FlaskConical, Send, Smartphone, CloudUpload } from "@lucide/vue";
import type { Component } from "vue";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RUN_ACTIONS } from "../lib/run-actions";

const action = defineModel<CiRunAction>({ required: true });

const ICONS: Record<CiRunAction, Component> = {
  ota: CloudUpload,
  native: Smartphone,
  check: FlaskConical,
  deliver: Send,
};

function select(value: unknown) {
  const match = RUN_ACTIONS.find((entry) => entry.action === value);
  if (match) action.value = match.action;
}
</script>

<template>
  <RadioGroup
    :model-value="action"
    class="grid gap-2 sm:grid-cols-2"
    aria-label="What to run"
    @update:model-value="select"
  >
    <label
      v-for="entry in RUN_ACTIONS"
      :key="entry.action"
      :for="`run-action-${entry.action}`"
      class="hover:bg-accent/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 has-[:focus-visible]:ring-ring/50 relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-3"
    >
      <RadioGroupItem :id="`run-action-${entry.action}`" :value="entry.action" class="sr-only" />
      <component
        :is="ICONS[entry.action]"
        class="text-muted-foreground mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <span class="min-w-0 space-y-0.5">
        <span class="block text-sm font-medium">{{ entry.label }}</span>
        <span class="text-muted-foreground block text-xs text-pretty">{{ entry.summary }}</span>
      </span>
    </label>
  </RadioGroup>
</template>
