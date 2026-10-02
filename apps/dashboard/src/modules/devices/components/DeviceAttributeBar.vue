<script setup lang="ts">
import { Info, Tag } from "@lucide/vue";
import { computed, ref } from "vue";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyToast } from "@/shared/composables/useCopyToast";
import { useWrapOverflow } from "@/shared/composables/useWrapOverflow";
import { attributeEntries } from "../lib/device-attributes";
import type { DeviceAttributes } from "../types/devices.types";
import AttributeChip from "./AttributeChip.vue";
import AttributeEmptyChip from "./AttributeEmptyChip.vue";
import AttributeListPopover from "./AttributeListPopover.vue";

const props = defineProps<{
  attributes: DeviceAttributes | null;
  updatedAt: string | null;
}>();

const ROWS = 2;

const entries = computed(() => attributeEntries(props.attributes));
const mirror = ref<HTMLElement | null>(null);
const fit = useWrapOverflow(mirror, entries, ROWS);
const shown = computed(() => entries.value.slice(0, fit.value));
const hidden = computed(() => entries.value.length - shown.value.length);
const { copyText } = useCopyToast();
</script>

<template>
  <div class="flex items-start gap-2">
    <Tag class="text-muted-foreground mt-1.5 size-3.5 shrink-0" aria-hidden="true" />
    <div class="relative min-w-0 flex-1">
      <template v-if="entries.length">
        <ul class="flex flex-wrap gap-1.5" aria-label="Attributes">
          <li v-for="entry in shown" :key="entry.key" class="flex min-w-0">
            <AttributeChip
              :name="entry.key"
              :value="entry.value"
              @copy="copyText(entry.value, entry.key)"
            />
          </li>
          <li v-if="hidden > 0" class="flex">
            <AttributeListPopover
              :entries="entries"
              :hidden="hidden"
              :updated-at="props.updatedAt"
            />
          </li>
        </ul>
        <div
          ref="mirror"
          inert
          aria-hidden="true"
          class="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-wrap gap-1.5"
        >
          <div v-for="entry in entries" :key="entry.key" class="flex min-w-0">
            <AttributeChip :name="entry.key" :value="entry.value" />
          </div>
        </div>
      </template>
      <AttributeEmptyChip v-else />
    </div>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-1 rounded-sm outline-none focus-visible:ring-3"
          aria-label="About attributes and personal data"
        >
          <Info class="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" class="max-w-72 text-pretty">
        Often personal data (Law 18-07). Prefer an opaque id over a name or a phone number, and
        clear attributes on sign-out.
      </TooltipContent>
    </Tooltip>
  </div>
</template>
