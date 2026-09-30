<script setup lang="ts">
import { SquareArrowOutUpRight } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { findArtefact } from "@/shared/delivery/lib/eligibility";
import { formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { Build } from "@/shared/types/build";
import type { ReleaseCatalog } from "@/shared/types/release";

const props = defineProps<{ build: Build; catalog: ReleaseCatalog }>();

const artefact = computed(() => {
  const id = props.build.bundle_id ?? props.build.native_id;
  return id ? (findArtefact(props.catalog, id) ?? null) : null;
});
</script>

<template>
  <dl class="bg-card grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm md:grid-cols-4">
    <div>
      <dt class="text-muted-foreground text-xs">Source</dt>
      <dd class="font-mono">{{ props.build.source }}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Flavour</dt>
      <dd><EnvBadge :environment="props.build.flavour" /></dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Ref</dt>
      <dd class="truncate font-mono">{{ props.build.ref ?? "—" }}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Commit</dt>
      <dd class="truncate font-mono" :title="props.build.commit_sha ?? undefined">
        {{ props.build.commit_sha?.slice(0, 12) ?? "—" }}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Started</dt>
      <dd>{{ formatDateTime(props.build.started_at ?? props.build.created_at) }}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Finished</dt>
      <dd>{{ formatDateTime(props.build.finished_at) }}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Duration</dt>
      <dd>
        <ElapsedTime
          :from="props.build.started_at ?? props.build.created_at"
          :to="props.build.finished_at"
        />
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-xs">Reported by</dt>
      <dd class="truncate">
        {{ props.build.actor_email ?? (props.build.actor_api_key_id ? "an API key" : "—") }}
      </dd>
    </div>
    <div class="col-span-2">
      <dt class="text-muted-foreground text-xs">Produced</dt>
      <dd>
        <RouterLink v-if="artefact" :to="{ name: RouteName.releases }" class="hover:underline">
          <VersionTag
            :kind="artefact.kind"
            :version="artefact.version_name"
            :code="artefact.kind === 'native' ? artefact.version_code : null"
          />
        </RouterLink>
        <span v-else class="text-muted-foreground">no artefact recorded</span>
      </dd>
    </div>
    <div class="col-span-2 flex flex-wrap items-end gap-3">
      <a
        v-if="props.build.pipeline_url"
        :href="props.build.pipeline_url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        Pipeline <SquareArrowOutUpRight class="size-3.5" />
      </a>
      <a
        v-if="props.build.job_url"
        :href="props.build.job_url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        Job <SquareArrowOutUpRight class="size-3.5" />
      </a>
    </div>
  </dl>
</template>
