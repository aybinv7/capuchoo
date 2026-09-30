<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppDetail, ProdRole } from "@/shared/types/session";
import type { useAppGeneral } from "../composables/useAppGeneral";
import SettingsSection from "./SettingsSection.vue";

const props = defineProps<{
  app: AppDetail;
  editable: boolean;
  update: ReturnType<typeof useAppGeneral>["update"];
}>();

const name = ref("");
const prodRole = ref<ProdRole>("admin");

watch(
  () => props.app,
  (app) => {
    name.value = app.name;
    prodRole.value = app.prod_role;
  },
  { immediate: true },
);

const dirty = computed(
  () => name.value.trim() !== props.app.name || prodRole.value !== props.app.prod_role,
);

function setProdRole(value: unknown) {
  if (value === "admin" || value === "developer") prodRole.value = value;
}

function save() {
  props.update.mutate(
    {
      ...(name.value.trim() !== props.app.name ? { name: name.value.trim() } : {}),
      ...(prodRole.value !== props.app.prod_role ? { prod_role: prodRole.value } : {}),
    },
    { onSuccess: () => toast.success("App settings saved") },
  );
}
</script>

<template>
  <SettingsSection
    title="General"
    :description="`${props.app.counts.channels} channels · ${props.app.counts.bundles} bundles · ${props.app.counts.natives} native builds · ${props.app.counts.devices} devices`"
  >
    <FieldGroup class="max-w-lg gap-5">
      <Field>
        <FieldLabel for="app-name">Name</FieldLabel>
        <Input id="app-name" v-model="name" maxlength="120" :disabled="!props.editable" />
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel>Who may deliver to prod</FieldLabel>
          <FieldDescription>
            Deliver, roll back and pause on prod channels, and edit prod releases. Dev and staging
            always need developer.
          </FieldDescription>
        </FieldContent>
        <ToggleGroup
          :model-value="prodRole"
          type="single"
          variant="outline"
          size="sm"
          :disabled="!props.editable"
          @update:model-value="setProdRole"
        >
          <ToggleGroupItem value="admin">Admins</ToggleGroupItem>
          <ToggleGroupItem value="developer">Developers</ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </FieldGroup>
    <template v-if="props.editable" #footer>
      <Button :disabled="!dirty || props.update.isPending.value" @click="save">
        <Spinner v-if="props.update.isPending.value" />
        Save
      </Button>
    </template>
  </SettingsSection>
</template>
