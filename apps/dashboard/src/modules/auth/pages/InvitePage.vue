<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { isApiError } from "@/shared/api/errors";
import AuthLayout from "@/shared/layouts/AuthLayout.vue";
import { formatDateTime } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import InviteAcceptForm from "../components/InviteAcceptForm.vue";
import { useInvitation } from "../composables/useInvitation";

const route = useRoute();
const token = computed(() => (typeof route.params.token === "string" ? route.params.token : ""));
const { preview, accept } = useInvitation(token);

const invitation = computed(() => preview.data.value ?? null);
const expired = computed(
  () => isApiError(preview.error.value) && preview.error.value.status === 404,
);
</script>

<template>
  <AuthLayout
    :title="invitation ? `Join ${invitation.organization}` : 'Accept an invitation'"
    :subtitle="
      invitation
        ? `You are invited as ${invitation.role}. The link expires ${formatDateTime(invitation.expires_at)}.`
        : undefined
    "
  >
    <div v-if="preview.isPending.value" class="space-y-3">
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-9 w-full" />
    </div>
    <div v-else-if="expired" class="space-y-2 text-sm">
      <p class="font-medium">This invitation is no longer valid.</p>
      <p class="text-muted-foreground">
        It was used, revoked, or it expired. Ask the person who invited you for a new link.
      </p>
      <RouterLink
        :to="{ name: RouteName.login }"
        class="text-primary inline-block pt-2 underline-offset-4 hover:underline"
        >Go to sign in</RouterLink
      >
    </div>
    <ErrorNotice
      v-else-if="preview.error.value"
      :error="preview.error.value"
      :retry="preview.refetch"
    />
    <InviteAcceptForm v-else-if="invitation" :invitation="invitation" :accept="accept" />
  </AuthLayout>
</template>
