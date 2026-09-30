<script setup lang="ts">
import { BadgeCheck, CircleSlash, ShieldAlert } from "@lucide/vue";
import { computed } from "vue";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import EnvBadge from "../../components/EnvBadge.vue";
import RelativeTime from "../../components/RelativeTime.vue";
import VersionTag from "../../components/VersionTag.vue";
import { formatBytes } from "../../lib/format";
import type { Candidate } from "../lib/eligibility";

const props = defineProps<{ candidate: Candidate; selected: boolean }>();

const artefact = computed(() => props.candidate.artefact);
const verdict = computed(() => props.candidate.preview.verdict);
</script>

<template>
  <label
    :class="
      cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
        verdict.ok ? 'hover:bg-accent/60 cursor-pointer' : 'cursor-not-allowed opacity-70',
        props.selected && 'border-primary bg-primary/5 ring-primary/30 ring-1',
      )
    "
  >
    <RadioGroupItem :value="artefact.id" :disabled="!verdict.ok" class="mt-0.5" />
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <VersionTag
          :kind="artefact.kind"
          :version="artefact.version_name"
          :code="artefact.kind === 'native' ? artefact.version_code : null"
          class="text-sm font-medium"
        />
        <EnvBadge :environment="artefact.flavour" size="sm" />
        <span class="text-muted-foreground font-mono text-[11px] uppercase">{{
          artefact.platform
        }}</span>
        <span
          v-if="artefact.required"
          class="bg-warning-soft text-warning rounded px-1 text-[10px] font-medium uppercase"
          >required</span
        >
        <BadgeCheck v-if="artefact.signed" class="text-success size-3.5" aria-label="Signed" />
        <ShieldAlert v-else class="text-muted-foreground size-3.5" aria-label="Unsigned" />
      </div>
      <p
        v-if="!verdict.ok"
        class="text-destructive/90 flex items-start gap-1.5 text-xs text-pretty"
      >
        <CircleSlash class="mt-px size-3 shrink-0" />
        {{ verdict.message }}
      </p>
      <p v-else-if="artefact.release_notes" class="text-muted-foreground line-clamp-2 text-xs">
        {{ artefact.release_notes }}
      </p>
    </div>
    <div class="text-muted-foreground shrink-0 text-right text-xs">
      <div class="font-mono tabular">{{ formatBytes(artefact.size_bytes) }}</div>
      <RelativeTime :value="artefact.created_at" />
    </div>
  </label>
</template>
