<script setup lang="ts">
import { computed } from "vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

const props = defineProps<{
  /** In the policy's own unit: milliseconds or bytes. */
  modelValue: number;
  /** Policy units per displayed unit, e.g. 60000 for minutes. */
  factor: number;
  unit: string;
  min: number;
  max: number;
  id?: string;
  step?: number;
}>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const shown = computed(() => Math.round((props.modelValue / props.factor) * 100) / 100);

function commit(event: Event) {
  const raw = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(raw)) return;
  const value = Math.round(raw * props.factor);
  emit("update:modelValue", Math.min(props.max, Math.max(props.min, value)));
}
</script>

<template>
  <InputGroup class="w-36">
    <InputGroupInput
      :id="props.id"
      type="number"
      inputmode="decimal"
      class="tabular text-right"
      :value="shown"
      :min="props.min / props.factor"
      :max="props.max / props.factor"
      :step="props.step ?? 1"
      @change="commit"
    />
    <InputGroupAddon align="inline-end">
      <InputGroupText>{{ props.unit }}</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
</template>
