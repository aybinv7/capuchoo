<script setup lang="ts">
import { Clock, Search, X } from "@lucide/vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const search = defineModel<string>("search", { required: true });
const timestamps = defineModel<boolean>("timestamps", { required: true });
const props = defineProps<{
  /** Lines matching the search across the loaded log, or null when there is no count to show. */
  matches: number | null;
  /** The log is being read for a search. */
  loading: boolean;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <h3 class="text-muted-foreground mr-auto text-xs font-medium tracking-wide uppercase">Steps</h3>
    <span class="text-muted-foreground text-xs tabular" role="status" aria-live="polite">
      <template v-if="props.loading">Reading the log…</template>
      <template v-else-if="props.matches === 0">No matches</template>
      <template v-else-if="props.matches !== null">
        {{ props.matches }} {{ props.matches === 1 ? "match" : "matches" }}
      </template>
    </span>
    <InputGroup class="h-8 w-full sm:w-56">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        v-model="search"
        type="search"
        placeholder="Search logs"
        aria-label="Search in logs"
        class="h-8 text-sm"
        @keydown.esc="search = ''"
      />
      <InputGroupAddon v-if="search" align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Clear the search" @click="search = ''">
          <X />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    <Tooltip>
      <TooltipTrigger as-child>
        <Toggle v-model="timestamps" size="sm" variant="outline" aria-label="Show timestamps">
          <Clock />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{{ timestamps ? "Hide timestamps" : "Show timestamps" }}</TooltipContent>
    </Tooltip>
  </div>
</template>
