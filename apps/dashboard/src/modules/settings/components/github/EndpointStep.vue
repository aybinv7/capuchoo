<script setup lang="ts">
import { Link2 } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { GithubSetup } from "@/shared/types/ci";
import type { useGithubSetup } from "../../composables/useGithubSetup";
import { variableState } from "../../lib/github-setup";

const props = defineProps<{
  setup: GithubSetup;
  variable: ReturnType<typeof useGithubSetup>["variable"];
}>();

const state = computed(() => variableState(props.setup));

function apply() {
  props.variable.mutate(undefined, {
    onSuccess: () => toast.success("CAPUCHOO_ENDPOINT set"),
  });
}
</script>

<template>
  <div class="space-y-3 text-sm">
    <p class="text-muted-foreground text-pretty">
      The repository variable
      <code class="text-foreground font-mono text-xs">CAPUCHOO_ENDPOINT</code> tells the workflow
      which Capuchoo to report to.
    </p>
    <p v-if="state.kind === 'set'" class="font-mono text-xs">{{ state.value }}</p>
    <p v-else-if="state.kind === 'wrong'" class="text-pretty">
      It points at <code class="font-mono text-xs">{{ state.value }}</code
      >; this server is <code class="font-mono text-xs">{{ state.expected }}</code
      >.
    </p>
    <Button
      v-if="state.kind !== 'set'"
      size="sm"
      :disabled="props.variable.isPending.value"
      @click="apply"
    >
      <Spinner v-if="props.variable.isPending.value" />
      <Link2 v-else />
      {{ state.kind === "wrong" ? "Point it here" : `Set to ${state.expected}` }}
    </Button>
    <ErrorNotice v-if="props.variable.error.value" :error="props.variable.error.value" />
  </div>
</template>
