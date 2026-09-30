<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import { computed, ref } from "vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup } from "@/components/ui/radio-group";
import type { Candidate } from "../lib/eligibility";
import CandidateRow from "./CandidateRow.vue";

const selected = defineModel<string | null>({ default: null });

const props = withDefaults(
  defineProps<{ candidates: readonly Candidate[]; emptyLabel: string; limit?: number }>(),
  { limit: 40 },
);

const showRefused = ref(false);
const accepted = computed(() =>
  props.candidates.filter((candidate) => candidate.preview.verdict.ok).slice(0, props.limit),
);
const refused = computed(() =>
  props.candidates.filter((candidate) => !candidate.preview.verdict.ok).slice(0, props.limit),
);
</script>

<template>
  <RadioGroup
    :model-value="selected ?? undefined"
    class="max-h-[40vh] gap-2 overflow-y-auto pr-1"
    @update:model-value="selected = String($event)"
  >
    <p
      v-if="accepted.length === 0"
      class="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm"
    >
      {{ props.emptyLabel }}
    </p>
    <CandidateRow
      v-for="candidate in accepted"
      :key="candidate.artefact.id"
      :candidate="candidate"
      :selected="selected === candidate.artefact.id"
    />
    <Collapsible v-if="refused.length" v-model:open="showRefused">
      <CollapsibleTrigger
        class="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 py-1 text-xs"
      >
        <ChevronDown class="size-3.5 transition-transform" :class="showRefused && 'rotate-180'" />
        {{ refused.length }} not eligible, with the reason the server would give
      </CollapsibleTrigger>
      <CollapsibleContent class="space-y-2 pt-1">
        <CandidateRow
          v-for="candidate in refused"
          :key="candidate.artefact.id"
          :candidate="candidate"
          :selected="false"
        />
      </CollapsibleContent>
    </Collapsible>
  </RadioGroup>
</template>
