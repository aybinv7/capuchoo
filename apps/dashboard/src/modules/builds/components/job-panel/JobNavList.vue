<script setup lang="ts">
import { cn } from "@/lib/utils";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import type { JobGroup } from "../../lib/job-selection";
import { jobEndedAt } from "../../lib/job-status";
import JobStatusIcon from "../pipeline/JobStatusIcon.vue";

const props = defineProps<{ groups: readonly JobGroup[]; selectedId: string | null }>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <nav aria-label="Jobs of this run" class="p-2">
    <div v-for="(group, index) in props.groups" :key="group.column">
      <p
        v-if="group.label"
        class="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase"
      >
        {{ group.label }}
      </p>
      <div v-else-if="index > 0" class="mx-2 my-1.5 border-t" aria-hidden="true" />
      <ul class="space-y-px">
        <li v-for="node in group.nodes" :key="node.id">
          <button
            type="button"
            :aria-current="node.id === props.selectedId ? 'true' : undefined"
            :class="
              cn(
                'hover:bg-muted focus-visible:ring-ring/50 relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2',
                node.id === props.selectedId &&
                  'bg-accent text-foreground before:bg-primary font-medium before:absolute before:inset-y-1.5 before:-left-2 before:w-0.5 before:rounded-full',
                (node.status === 'pending' || node.status === 'skipped') && 'text-muted-foreground',
              )
            "
            @click="emit('select', node.id)"
          >
            <JobStatusIcon
              :status="node.status"
              :gated="node.gated && node.status === 'waiting'"
              class="size-3.5"
            />
            <span class="min-w-0 flex-1 truncate" :title="node.name">{{ node.name }}</span>
            <span v-if="node.job?.started_at" class="text-muted-foreground shrink-0 text-[11px]">
              <ElapsedTime :from="node.job.started_at" :to="jobEndedAt(node.job)" />
            </span>
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>
