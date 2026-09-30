<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useSession } from "@/shared/composables/useSession";
import { useProfile } from "../composables/useProfile";
import SettingsSection from "./SettingsSection.vue";

const { user } = useSession();
const { rename } = useProfile();
const fullName = ref("");

watch(
  () => user.value?.full_name,
  (value) => {
    fullName.value = value ?? "";
  },
  { immediate: true },
);

const dirty = computed(() => fullName.value.trim() !== (user.value?.full_name ?? ""));

function save() {
  rename.mutate(fullName.value.trim() || null, { onSuccess: () => toast.success("Profile saved") });
}
</script>

<template>
  <SettingsSection
    title="Profile"
    description="Shown in history and audit entries next to what you did."
  >
    <FieldGroup class="max-w-md gap-4">
      <Field>
        <FieldLabel for="profile-email">Email</FieldLabel>
        <Input id="profile-email" :model-value="user?.email ?? ''" readonly />
      </Field>
      <Field>
        <FieldLabel for="profile-name">Full name</FieldLabel>
        <Input id="profile-name" v-model="fullName" maxlength="120" autocomplete="name" />
      </Field>
      <ErrorNotice v-if="rename.error.value" :error="rename.error.value" />
    </FieldGroup>
    <template #footer>
      <Button :disabled="!dirty || rename.isPending.value" @click="save">
        <Spinner v-if="rename.isPending.value" />
        Save
      </Button>
    </template>
  </SettingsSection>
</template>
