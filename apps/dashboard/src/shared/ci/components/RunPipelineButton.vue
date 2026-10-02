<script setup lang="ts">
import { Play, Settings2 } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RouteName } from "../../router/route-names";
import { useRunGate } from "../composables/useRunGate";

const props = withDefaults(
  defineProps<{ size?: "sm" | "default"; variant?: "default" | "outline" }>(),
  { size: "sm", variant: "default" },
);
const emit = defineEmits<{ run: [] }>();

const gate = useRunGate();
</script>

<template>
  <Button
    v-if="gate.allowed.value"
    :size="props.size"
    :variant="props.variant"
    @click="emit('run')"
  >
    <Play />
    Run pipeline
  </Button>
  <Popover v-else>
    <PopoverTrigger as-child>
      <Button
        :size="props.size"
        variant="outline"
        class="text-muted-foreground"
        :disabled="gate.pending.value"
      >
        <Play />
        Run pipeline
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-80 space-y-3">
      <p class="text-sm text-pretty">{{ gate.reason.value }}</p>
      <Button v-if="gate.canConfigure.value" as-child size="sm" variant="outline">
        <RouterLink :to="{ name: RouteName.appCi }">
          <Settings2 />
          Open CI settings
        </RouterLink>
      </Button>
    </PopoverContent>
  </Popover>
</template>
