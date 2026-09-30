<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { RouterView } from "vue-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const mode = useColorMode({ storageKey: "capuchoo.theme" });
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <RouterView />
    <Toaster
      rich-colors
      close-button
      position="bottom-right"
      :theme="mode === 'dark' ? 'dark' : 'light'"
    />
  </TooltipProvider>
</template>
