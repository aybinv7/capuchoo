<script setup lang="ts">
import { Scissors, SquareArrowOutUpRight } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BuildSource } from "@/shared/types/build";
import { providerLabel } from "@/shared/lib/run-meta";

const props = defineProps<{ provider: BuildSource; url: string | null }>();
</script>

<template>
  <Alert class="border-warning/40 bg-warning-soft/50 py-2">
    <Scissors />
    <AlertDescription class="flex flex-wrap items-center gap-x-2 text-xs">
      <span>This log is longer than Capuchoo keeps, so its end is cut.</span>
      <a
        v-if="props.url"
        :href="props.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary inline-flex items-center gap-1 font-medium hover:underline"
      >
        Read it whole in {{ providerLabel(props.provider) }}
        <SquareArrowOutUpRight class="size-3" />
      </a>
    </AlertDescription>
  </Alert>
</template>
