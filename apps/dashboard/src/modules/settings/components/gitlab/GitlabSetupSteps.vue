<script setup lang="ts">
import CopyField from "@/shared/components/CopyField.vue";

defineProps<{ webhookUrl: string; token: string | null }>();
</script>

<template>
  <ol class="space-y-4 text-sm">
    <li class="space-y-1.5">
      <p class="font-medium">
        1. In GitLab, open the project → Settings → Webhooks → Add new webhook.
      </p>
    </li>
    <li class="space-y-1.5">
      <p class="font-medium">2. URL</p>
      <CopyField :value="webhookUrl" label="Webhook URL" />
    </li>
    <li class="space-y-1.5">
      <p class="font-medium">3. Secret token</p>
      <CopyField v-if="token" :value="token" label="Secret token" secret />
      <p v-else class="text-muted-foreground">
        Shown once when connecting. Rotate it to get a new one; the old token stops working.
      </p>
    </li>
    <li class="space-y-1.5">
      <p class="font-medium">
        4. Trigger: tick Pipeline events and Job events, keep SSL verification on, save.
      </p>
      <p class="text-muted-foreground">
        Pipelines then appear in Builds and on the canvas as they run. Use “Test → Pipeline events”
        in GitLab to check the connection; the last event time below updates.
      </p>
    </li>
  </ol>
</template>
