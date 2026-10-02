<script setup lang="ts">
import { isTerminalBuildStatus } from "@capuchoo/core";
import { ChevronDown, RefreshCw, RotateCcw, SquareArrowOutUpRight, Square } from "@lucide/vue";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { notifyError } from "@/shared/lib/notify";
import { hasAppRole } from "@/shared/lib/roles";
import type { Build } from "@/shared/types/build";
import type { useBuildActions } from "../../composables/useBuildActions";
import { providerLabel } from "@/shared/lib/run-meta";

const props = defineProps<{ build: Build; actions: ReturnType<typeof useBuildActions> }>();

const { role } = useAppPermissions();
const canOperate = computed(() => hasAppRole(role.value, "developer"));
const finished = computed(() => isTerminalBuildStatus(props.build.status));
const confirmCancel = ref(false);

const cancel = computed(() => props.actions.cancel);
const rerun = computed(() => props.actions.rerun);
const sync = computed(() => props.actions.sync);

function runCancel() {
  cancel.value.mutate(undefined, { onSuccess: () => (confirmCancel.value = false) });
}

function runSync() {
  sync.value.mutate(undefined, { onError: notifyError });
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="sync.isPending.value"
          aria-label="Read the run back from the provider"
          @click="runSync"
        >
          <Spinner v-if="sync.isPending.value" />
          <RefreshCw v-else />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Sync with {{ providerLabel(props.build.source) }}</TooltipContent>
    </Tooltip>

    <Button v-if="props.build.pipeline_url" as-child variant="outline" size="sm">
      <a :href="props.build.pipeline_url" target="_blank" rel="noopener noreferrer">
        <ProviderIcon :provider="props.build.source" />
        <span class="hidden sm:inline">Open in {{ providerLabel(props.build.source) }}</span>
        <SquareArrowOutUpRight class="size-3.5" />
      </a>
    </Button>

    <template v-if="canOperate">
      <Button
        v-if="!finished"
        variant="outline"
        size="sm"
        :disabled="cancel.isPending.value"
        @click="confirmCancel = true"
      >
        <Square />
        Cancel
      </Button>

      <ButtonGroup v-else-if="props.build.status === 'failed'">
        <Button size="sm" :disabled="rerun.isPending.value" @click="rerun.mutate(true)">
          <Spinner v-if="rerun.isPending.value" />
          <RotateCcw v-else />
          Re-run failed
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="icon-sm"
              :disabled="rerun.isPending.value"
              aria-label="More re-run options"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="rerun.mutate(false)">
              <RotateCcw class="size-4" />
              Re-run all jobs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <Button
        v-else
        variant="outline"
        size="sm"
        :disabled="rerun.isPending.value"
        @click="rerun.mutate(false)"
      >
        <Spinner v-if="rerun.isPending.value" />
        <RotateCcw v-else />
        Re-run
      </Button>
    </template>

    <ConfirmDialog
      v-model:open="confirmCancel"
      title="Cancel this run"
      :description="`${providerLabel(props.build.source)} stops every job still running or queued. A deploy already uploading may still finish.`"
      confirm-label="Cancel run"
      destructive
      :pending="cancel.isPending.value"
      @confirm="runCancel"
    />
  </div>
</template>
