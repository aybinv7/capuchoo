<script setup lang="ts">
import { Headset } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RouteName } from "@/shared/router/route-names";

const props = defineProps<{ deviceId: string; deviceName: string }>();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="outline" size="sm" as-child>
        <RouterLink
          :to="{
            name: RouteName.recordingAssist,
            params: { deviceId: props.deviceId },
            query: { name: props.deviceName },
          }"
        >
          <Headset />
          <span class="hidden md:inline">Assist</span>
        </RouterLink>
      </Button>
    </TooltipTrigger>
    <TooltipContent>See the user's screen live and help them - they accept first</TooltipContent>
  </Tooltip>
</template>
