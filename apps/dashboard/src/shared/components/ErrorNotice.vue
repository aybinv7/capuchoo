<script setup lang="ts">
import { CircleAlert, RotateCw } from "@lucide/vue";
import { computed } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorMessage, errorTitle, isApiError } from "../api/errors";

const props = defineProps<{ error: unknown; retry?: () => unknown }>();

const reason = computed(() => (isApiError(props.error) ? props.error.reason : null));
</script>

<template>
  <Alert variant="destructive" class="border-destructive/30 bg-danger-soft/40">
    <CircleAlert />
    <AlertTitle class="flex items-center gap-2">
      {{ errorTitle(props.error) }}
      <code
        v-if="reason"
        class="rounded bg-destructive/10 px-1 font-mono text-[10px] font-normal"
        >{{ reason }}</code
      >
    </AlertTitle>
    <AlertDescription class="text-pretty">
      <p>{{ errorMessage(props.error) }}</p>
      <Button v-if="props.retry" variant="outline" size="xs" class="mt-2" @click="props.retry()">
        <RotateCw />
        Retry
      </Button>
    </AlertDescription>
  </Alert>
</template>
