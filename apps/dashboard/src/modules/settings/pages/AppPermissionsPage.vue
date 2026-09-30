<script setup lang="ts">
import { APP_ROLE_ORDER, type AppRole } from "@capuchoo/core";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import SettingsSection from "../components/SettingsSection.vue";
import { useAppAccess } from "../composables/useAppAccess";

const ROLES = [...APP_ROLE_ORDER].reverse();
const DESCRIPTIONS: Record<AppRole, string> = {
  admin: "everything, including channels, keys and settings",
  developer: "upload and deliver to dev and staging",
  tester: "read, and install test builds",
  viewer: "read only",
};

const { appId } = useCurrentApp();
const permissions = useAppPermissions();
const isAdmin = computed(() => permissions.isAdmin.value);
const { permissions: list, grant, revoke } = useAppAccess(appId, isAdmin);

const email = ref("");
const role = ref<AppRole>("developer");
const valid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()));

function submit() {
  if (!valid.value) return;
  grant.mutate(
    { email: email.value.trim().toLowerCase(), role: role.value },
    {
      onSuccess: (row) => {
        toast.success(`${row.users.email} is ${row.role} on this app`);
        email.value = "";
      },
    },
  );
}
</script>

<template>
  <SettingsSection
    v-if="!isAdmin"
    title="Access"
    description="Only app admins can see and change who has access."
  >
    <p class="text-muted-foreground text-sm">
      Your role on this app is {{ permissions.role.value ?? "none" }}.
    </p>
  </SettingsSection>
  <template v-else>
    <SettingsSection
      title="Grant a role"
      description="For people who already have an account; invite anyone else to the organization first. Organization owners and admins are app admins without a grant."
    >
      <form class="flex flex-wrap items-center gap-2" novalidate @submit.prevent="submit">
        <Input
          v-model="email"
          type="email"
          class="w-72"
          placeholder="name@company.com"
          aria-label="Email"
        />
        <NativeSelect v-model="role" class="h-9 w-36" aria-label="Role">
          <NativeSelectOption v-for="option in ROLES" :key="option" :value="option">{{
            option
          }}</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" :disabled="!valid || grant.isPending.value">
          <Spinner v-if="grant.isPending.value" />
          Grant
        </Button>
      </form>
      <p class="text-muted-foreground mt-2 text-xs">{{ role }}: {{ DESCRIPTIONS[role] }}.</p>
      <ErrorNotice v-if="grant.error.value" :error="grant.error.value" class="mt-3" />
    </SettingsSection>

    <SettingsSection title="Direct roles">
      <ErrorNotice v-if="list.error.value" :error="list.error.value" :retry="list.refetch" />
      <Skeleton v-else-if="list.isPending.value" class="h-24 w-full" />
      <p v-else-if="!list.data.value?.length" class="text-muted-foreground text-sm">
        Nobody holds a direct role on this app.
      </p>
      <ul v-else class="divide-y rounded-lg border">
        <li
          v-for="entry in list.data.value"
          :key="entry.user_id"
          class="flex items-center gap-3 px-4 py-2.5 text-sm"
        >
          <div class="flex-1">
            <div class="font-medium">{{ entry.users.full_name || entry.users.email }}</div>
            <div v-if="entry.users.full_name" class="text-muted-foreground text-xs">
              {{ entry.users.email }}
            </div>
          </div>
          <span class="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{{ entry.role }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive"
            :disabled="revoke.isPending.value"
            @click="revoke.mutate(entry.user_id)"
            >Revoke</Button
          >
        </li>
      </ul>
    </SettingsSection>
  </template>
</template>
