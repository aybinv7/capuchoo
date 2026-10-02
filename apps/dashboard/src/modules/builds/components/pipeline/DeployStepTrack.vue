<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import type { BuildChild, BuildStepStatus } from "@/shared/types/build";
import { currentDeployStep, deploySteps } from "../../lib/deploy-steps";

const props = defineProps<{ deploy: BuildChild }>();

const steps = computed(() => deploySteps(props.deploy.events));
const current = computed(() => currentDeployStep(steps.value));

const SEGMENT: Record<BuildStepStatus, string> = {
  running: "bg-info animate-pulse motion-reduce:animate-none",
  succeeded: "bg-success/80",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/25",
  info: "bg-muted-foreground/25",
};

const target = computed(() => {
  const parts = [props.deploy.kind === "native" ? "Native" : "OTA"];
  if (props.deploy.version_name) parts.push(props.deploy.version_name);
  return `${parts.join(" ")}${props.deploy.channel_name ? ` → ${props.deploy.channel_name}` : ""}`;
});
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-2 text-[11px]">
      <span class="text-muted-foreground shrink-0 font-medium">Deploy</span>
      <span class="min-w-0 truncate font-mono">{{ target }}</span>
      <span
        v-if="current"
        :class="
          cn(
            'ml-auto shrink-0 font-mono',
            current.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
          )
        "
        :title="current.message ?? undefined"
        >{{ current.step }}</span
      >
    </div>
    <ol
      class="flex h-1 gap-px overflow-hidden rounded-full"
      :aria-label="`Deploy steps: ${steps.map((step) => `${step.step} ${step.status}`).join(', ') || 'none yet'}`"
    >
      <li
        v-for="step in steps"
        :key="step.step"
        :title="`${step.step}: ${step.status}`"
        :class="cn('h-full flex-1', SEGMENT[step.status])"
      />
      <li v-if="steps.length === 0" class="bg-muted-foreground/15 h-full flex-1" />
    </ol>
  </div>
</template>
