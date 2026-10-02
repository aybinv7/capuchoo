<script setup lang="ts">
import { Check, Copy } from "@lucide/vue";
import { useClipboard } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const props = defineProps<{ value: string; label: string; class?: string }>();

const { copy, copied, isSupported } = useClipboard({ copiedDuring: 1500, legacy: true });
</script>

<template>
  <Button
    v-if="isSupported"
    variant="ghost"
    size="icon-xs"
    :class="cn('text-muted-foreground hover:text-foreground', props.class)"
    :aria-label="copied ? 'Copied' : `Copy ${props.label}`"
    :title="copied ? 'Copied' : `Copy ${props.label}`"
    @click.stop="copy(props.value)"
  >
    <Check v-if="copied" class="text-success" />
    <Copy v-else />
  </Button>
</template>
