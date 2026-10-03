<script setup lang="ts">
import { Keyboard } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SHORTCUTS: Array<[string[], string]> = [
  [["Space"], "Play or pause"],
  [["←", "→"], "Back or forward 5 s (with Shift, 30 s)"],
  [["N", "P"], "Next or previous issue"],
  [["S"], "Hide or show the inspector"],
  [["D"], "Open the data tables"],
  [["B"], "Bring the inspector back"],
  [["F"], "Follow a live session"],
  [["E"], "Export the steps as a test"],
];
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
        <Keyboard />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-72">
      <dl class="space-y-2 text-xs">
        <div v-for="[keys, label] in SHORTCUTS" :key="label" class="flex items-center gap-3">
          <dt class="flex w-20 shrink-0 gap-1">
            <Kbd v-for="key in keys" :key="key">{{ key }}</Kbd>
          </dt>
          <dd class="text-muted-foreground">{{ label }}</dd>
        </div>
      </dl>
    </PopoverContent>
  </Popover>
</template>
