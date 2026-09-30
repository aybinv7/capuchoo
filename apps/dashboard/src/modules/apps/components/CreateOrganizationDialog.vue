<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useWorkspaceStore } from "@/shared/stores/workspace.store";
import { useAppRegistration } from "../composables/useAppRegistration";

const open = defineModel<boolean>("open", { required: true });

const workspace = useWorkspaceStore();
const { registerOrganization } = useAppRegistration();
const name = ref("");

watch(open, (value) => {
  if (!value) return;
  registerOrganization.reset();
  name.value = "";
});

const ready = computed(() => name.value.trim().length > 0 && !registerOrganization.isPending.value);

function submit() {
  if (!ready.value) return;
  registerOrganization.mutate(name.value.trim(), {
    onSuccess: (org) => {
      workspace.selectOrganization(org.id);
      toast.success(`${org.name} created`);
      open.value = false;
    },
  });
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New organization</DialogTitle>
        <DialogDescription
          >You become its owner. Invite people from its settings.</DialogDescription
        >
      </DialogHeader>
      <form id="create-org" novalidate @submit.prevent="submit">
        <Field>
          <FieldLabel for="org-name">Name</FieldLabel>
          <Input id="org-name" v-model="name" maxlength="120" autofocus />
        </Field>
      </form>
      <ErrorNotice
        v-if="registerOrganization.error.value"
        :error="registerOrganization.error.value"
      />
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button type="submit" form="create-org" :disabled="!ready">
          <Spinner v-if="registerOrganization.isPending.value" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
