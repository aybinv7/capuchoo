<script setup lang="ts">
import { Search } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useCommandStore } from "../../stores/command.store";

const store = useCommandStore();
const modifier = computed(() =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl",
);
</script>

<template>
  <Button
    variant="outline"
    class="text-muted-foreground bg-background/60 hidden h-8 w-64 justify-start gap-2 px-2.5 font-normal shadow-none md:flex lg:w-80"
    aria-keyshortcuts="Control+K Meta+K /"
    @click="store.show()"
  >
    <Search class="size-4" />
    <span class="truncate text-sm">Search or run a command…</span>
    <KbdGroup class="ml-auto">
      <Kbd>{{ modifier }}</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  </Button>
  <Button
    variant="ghost"
    size="icon-sm"
    class="md:hidden"
    aria-label="Search"
    @click="store.show()"
  >
    <Search />
  </Button>
</template>
