<script setup lang="ts">
import { Check, Copy, Eye, EyeOff } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { ref } from "vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

const props = withDefaults(defineProps<{ value: string; secret?: boolean; label?: string }>(), {
  secret: false,
  label: "Value",
});

const revealed = ref(!props.secret);
const { copy, copied, isSupported } = useClipboard({ copiedDuring: 1500, legacy: true });
</script>

<template>
  <InputGroup>
    <InputGroupInput
      :model-value="props.value"
      :type="revealed ? 'text' : 'password'"
      readonly
      :aria-label="props.label"
      class="font-mono text-xs"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <InputGroupAddon align="inline-end">
      <InputGroupButton
        v-if="props.secret"
        size="icon-xs"
        :aria-label="revealed ? 'Hide' : 'Reveal'"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" />
        <Eye v-else />
      </InputGroupButton>
      <InputGroupButton
        v-if="isSupported"
        size="icon-xs"
        :aria-label="copied ? 'Copied' : `Copy ${props.label}`"
        @click="copy(props.value)"
      >
        <Check v-if="copied" class="text-success" />
        <Copy v-else />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
