<script setup lang="ts">
import { Link } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import CopyField from "@/shared/components/CopyField.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { OrgRole } from "@/shared/types/session";
import type { useOrganizationMembers } from "../composables/useOrganizationMembers";

const props = defineProps<{
  invite: ReturnType<typeof useOrganizationMembers>["invite"];
  canGrantOwner: boolean;
}>();

const email = ref("");
const role = ref<OrgRole>("member");
const link = ref<{ email: string; url: string } | null>(null);

const valid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()));

function submit() {
  if (!valid.value || props.invite.isPending.value) return;
  const address = email.value.trim().toLowerCase();
  link.value = null;
  props.invite.mutate(
    { email: address, role: role.value },
    {
      onSuccess: (result) => {
        email.value = "";
        if ("invitation" in result) {
          link.value = { email: address, url: result.invitation.url };
          return;
        }
        toast.success(`${address} already had an account and was added`);
      },
    },
  );
}
</script>

<template>
  <div class="space-y-3">
    <form class="flex flex-wrap items-center gap-2" novalidate @submit.prevent="submit">
      <Input
        v-model="email"
        type="email"
        placeholder="name@company.com"
        class="w-72"
        aria-label="Email to invite"
        autocomplete="off"
      />
      <NativeSelect v-model="role" class="h-9 w-32" aria-label="Role">
        <NativeSelectOption value="member">member</NativeSelectOption>
        <NativeSelectOption value="admin">admin</NativeSelectOption>
        <NativeSelectOption v-if="props.canGrantOwner" value="owner">owner</NativeSelectOption>
      </NativeSelect>
      <Button type="submit" :disabled="!valid || props.invite.isPending.value">
        <Spinner v-if="props.invite.isPending.value" />
        Invite
      </Button>
    </form>
    <ErrorNotice v-if="props.invite.error.value" :error="props.invite.error.value" />
    <div v-if="link" class="bg-info-soft/40 space-y-2 rounded-lg border px-4 py-3">
      <p class="flex items-center gap-2 text-sm">
        <Link class="size-4" />
        Send this link to {{ link.email }}. It works once and expires in 7 days.
      </p>
      <CopyField :value="link.url" label="Invitation link" />
      <p class="text-muted-foreground text-xs">
        The server sends no email; share the link yourself.
      </p>
    </div>
  </div>
</template>
