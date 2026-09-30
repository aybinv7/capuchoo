<script setup lang="ts">
import { storeToRefs } from "pinia";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommandStore } from "../../stores/command.store";
import PaletteBody from "./PaletteBody.vue";

const { open } = storeToRefs(useCommandStore());
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="top-[12svh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader class="sr-only">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription
          >Find a page, channel, release, build or device, or run a command.</DialogDescription
        >
      </DialogHeader>
      <PaletteBody />
    </DialogContent>
  </Dialog>
</template>
