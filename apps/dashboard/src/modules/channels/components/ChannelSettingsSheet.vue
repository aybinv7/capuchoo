<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Channel, ChannelHistoryEntry } from "@/shared/types/release";
import ChannelSettingsForm from "./ChannelSettingsForm.vue";

const props = defineProps<{
  channel: Channel;
  channels: readonly Channel[];
  history: readonly ChannelHistoryEntry[];
  historyReady: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <SheetHeader class="border-b">
        <SheetTitle class="flex items-center gap-2">
          Settings
          <span class="text-muted-foreground font-mono text-sm font-normal">{{
            props.channel.name
          }}</span>
        </SheetTitle>
        <SheetDescription
          >Which devices this channel serves, and where it delivers.</SheetDescription
        >
      </SheetHeader>
      <div class="p-4">
        <ChannelSettingsForm
          :channel="props.channel"
          :channels="props.channels"
          :history="props.history"
          :history-ready="props.historyReady"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
