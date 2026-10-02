<script setup lang="ts">
import { ArrowUpRight, SquareArrowOutUpRight } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import { formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { BuildSource } from "@/shared/types/build";
import { JOB_STATUS_LABEL, isJobFinished, jobCaption } from "../../lib/job-status";
import type { PipelineNodeModel } from "../../lib/pipeline-graph";
import { providerLabel } from "../../lib/run-meta";
import BuildEventTimeline from "../BuildEventTimeline.vue";
import JobStatusIcon from "./JobStatusIcon.vue";
import JobStepList from "./JobStepList.vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  node: PipelineNodeModel | null;
  upstream: readonly string[];
  provider: BuildSource;
}>();

const job = computed(() => props.node?.job ?? null);
const deploy = computed(() => props.node?.deploy ?? null);
const endedAt = computed(() => {
  const value = job.value;
  if (!value) return null;
  return value.finished_at ?? (isJobFinished(value.status) ? value.updated_at : null);
});
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
      <template v-if="props.node">
        <SheetHeader class="border-b px-5 py-4">
          <SheetTitle class="flex items-center gap-2 pr-6">
            <JobStatusIcon :status="props.node.status" :gated="props.node.gated" />
            <span class="truncate">{{ props.node.name }}</span>
          </SheetTitle>
          <SheetDescription>{{ jobCaption(props.node) }}</SheetDescription>
          <Button v-if="job?.url" as-child variant="outline" size="sm" class="mt-2 w-fit">
            <a :href="job.url" target="_blank" rel="noopener noreferrer">
              <ProviderIcon :provider="props.provider" />
              Open job in {{ providerLabel(props.provider) }}
              <SquareArrowOutUpRight class="size-3.5" />
            </a>
          </Button>
        </SheetHeader>

        <div class="space-y-6 px-5 py-4">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-muted-foreground text-xs">Status</dt>
              <dd>{{ JOB_STATUS_LABEL[props.node.status] }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">Duration</dt>
              <dd>
                <ElapsedTime v-if="job?.started_at" :from="job.started_at" :to="endedAt" />
                <span v-else class="text-muted-foreground">—</span>
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">Started</dt>
              <dd>{{ formatDateTime(job?.started_at) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">Runner</dt>
              <dd class="truncate font-mono text-xs">{{ job?.runner ?? "—" }}</dd>
            </div>
            <div v-if="props.node.stage">
              <dt class="text-muted-foreground text-xs">Stage</dt>
              <dd class="font-mono text-xs">{{ props.node.stage }}</dd>
            </div>
            <div v-if="job && job.attempt > 1">
              <dt class="text-muted-foreground text-xs">Attempt</dt>
              <dd class="tabular">#{{ job.attempt }}</dd>
            </div>
          </dl>

          <section v-if="props.node.condition || props.upstream.length" class="space-y-2 text-sm">
            <p v-if="props.upstream.length" class="text-muted-foreground">
              Runs after
              <span class="text-foreground font-mono text-xs">{{ props.upstream.join(", ") }}</span>
            </p>
            <pre
              v-if="props.node.condition"
              class="bg-muted overflow-x-auto rounded-md px-3 py-2 font-mono text-xs"
            >
if: {{ props.node.condition }}</pre>
          </section>

          <section class="space-y-2">
            <h3 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Steps</h3>
            <JobStepList v-if="job?.steps.length" :steps="job.steps" />
            <p v-else class="text-muted-foreground text-sm">
              {{
                props.node.status === "pending" || props.node.status === "queued"
                  ? "Steps appear once a runner picks the job up."
                  : "The provider reported no steps for this job."
              }}
            </p>
          </section>

          <section v-if="deploy" class="space-y-3">
            <header class="flex items-center justify-between gap-2">
              <h3 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Capuchoo deploy
              </h3>
              <BuildStatusBadge :status="deploy.status" />
            </header>
            <p class="text-sm">
              <span class="font-mono"
                >{{ deploy.kind.toUpperCase() }} {{ deploy.version_name ?? "" }}</span
              >
              <span v-if="deploy.channel_name" class="text-muted-foreground">
                → {{ deploy.channel_name }}</span
              >
            </p>
            <p v-if="deploy.error" class="text-destructive font-mono text-xs whitespace-pre-wrap">
              {{ deploy.error }}
            </p>
            <BuildEventTimeline
              v-if="deploy.events.length"
              :events="deploy.events"
              :started-at="deploy.started_at ?? deploy.created_at"
            />
            <p v-else class="text-muted-foreground text-sm">No deploy step reported yet.</p>
            <RouterLink
              :to="{ name: RouteName.build, params: { buildId: deploy.id } }"
              class="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              Open the deploy <ArrowUpRight class="size-3.5" />
            </RouterLink>
          </section>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
