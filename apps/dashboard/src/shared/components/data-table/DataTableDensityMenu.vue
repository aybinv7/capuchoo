<script setup lang="ts">
import { Rows2, Rows3, Rows4 } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DENSITIES, type Density } from "./types";

const density = defineModel<Density>({ required: true });

const ICONS = { compact: Rows4, normal: Rows3, comfortable: Rows2 } as const;
const LABELS: Record<Density, string> = {
  compact: "Compact",
  normal: "Default",
  comfortable: "Comfortable",
};

const icon = computed(() => ICONS[density.value]);

function choose(value: unknown) {
  if (DENSITIES.includes(value as Density)) density.value = value as Density;
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8"
        :aria-label="`Row density: ${LABELS[density]}`"
      >
        <component :is="icon" />
        <span class="hidden lg:inline">{{ LABELS[density] }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <DropdownMenuLabel class="text-muted-foreground text-xs">Row density</DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="density" @update:model-value="choose">
        <DropdownMenuRadioItem v-for="value in DENSITIES" :key="value" :value="value">
          <component :is="ICONS[value]" />
          {{ LABELS[value] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
