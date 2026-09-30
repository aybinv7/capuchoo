<script setup lang="ts">
import { Search, X } from "@lucide/vue";
import { watchDebounced } from "@vueuse/core";
import { ref, watch } from "vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{ placeholder?: string; debounce?: number }>(), {
  placeholder: "Search",
  debounce: 250,
});

const draft = ref(model.value);

watchDebounced(
  draft,
  (value) => {
    if (value !== model.value) model.value = value;
  },
  { debounce: props.debounce },
);

watch(model, (value) => {
  if (value !== draft.value) draft.value = value;
});

function clear() {
  draft.value = "";
  model.value = "";
}
</script>

<template>
  <InputGroup class="h-8 w-full sm:w-64">
    <InputGroupAddon><Search /></InputGroupAddon>
    <InputGroupInput
      v-model="draft"
      :placeholder="props.placeholder"
      :aria-label="props.placeholder"
      @keydown.escape="clear"
    />
    <InputGroupAddon v-if="draft" align="inline-end">
      <InputGroupButton size="icon-xs" aria-label="Clear search" @click="clear">
        <X />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
