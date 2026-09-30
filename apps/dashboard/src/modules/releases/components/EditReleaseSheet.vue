<script setup lang="ts">
import { ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { artefactLabel } from "@/shared/lib/format";
import type { Artefact } from "@/shared/types/release";
import type { useReleaseMutations } from "../composables/useReleaseMutations";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  artefact: Artefact | null;
  update: ReturnType<typeof useReleaseMutations>["update"];
}>();

const required = ref(false);
const notes = ref("");

watch(open, (value) => {
  if (!value || !props.artefact) return;
  props.update.reset();
  required.value = props.artefact.required;
  notes.value = props.artefact.release_notes ?? "";
});

function save() {
  const artefact = props.artefact;
  if (!artefact) return;
  props.update.mutate(
    { artefact, patch: { required: required.value, release_notes: notes.value.trim() || null } },
    {
      onSuccess: () => {
        toast.success(`${artefactLabel(artefact)} updated`);
        open.value = false;
      },
    },
  );
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 sm:max-w-md">
      <SheetHeader class="border-b">
        <SheetTitle class="font-mono">{{
          props.artefact ? artefactLabel(props.artefact) : ""
        }}</SheetTitle>
        <SheetDescription
          >The artefact itself never changes; only how devices treat it.</SheetDescription
        >
      </SheetHeader>
      <FieldGroup class="flex-1 gap-5 overflow-y-auto p-4">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel for="release-required">Required update</FieldLabel>
            <FieldDescription>Devices apply it without asking the user.</FieldDescription>
          </FieldContent>
          <Switch id="release-required" v-model="required" />
        </Field>
        <Field>
          <FieldLabel for="release-notes">Release notes</FieldLabel>
          <Textarea id="release-notes" v-model="notes" rows="10" maxlength="10000" />
        </Field>
        <ErrorNotice v-if="props.update.error.value" :error="props.update.error.value" />
      </FieldGroup>
      <SheetFooter class="border-t">
        <Button :disabled="props.update.isPending.value" @click="save">
          <Spinner v-if="props.update.isPending.value" />
          Save
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
