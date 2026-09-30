<script setup lang="ts">
import { Button } from "@/components/ui/button";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatDateTime } from "@/shared/lib/format";
import type { Invitation } from "../types/settings.types";

defineProps<{ invitations: readonly Invitation[]; pendingId: string | null }>();
const emit = defineEmits<{ revoke: [invitation: Invitation] }>();
</script>

<template>
  <p v-if="invitations.length === 0" class="text-muted-foreground text-sm">
    No pending invitations.
  </p>
  <ul v-else class="divide-y rounded-lg border">
    <li
      v-for="invitation in invitations"
      :key="invitation.id"
      class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
    >
      <div>
        <div class="font-medium">{{ invitation.email }}</div>
        <div class="text-muted-foreground text-xs">
          {{ invitation.role }} · sent <RelativeTime :value="invitation.created_at" /> · expires
          {{ formatDateTime(invitation.expires_at) }}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="text-destructive"
        :disabled="pendingId === invitation.id"
        @click="emit('revoke', invitation)"
        >Revoke</Button
      >
    </li>
  </ul>
</template>
