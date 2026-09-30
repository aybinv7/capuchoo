<script setup lang="ts">
import { isValidBundleId } from "@capuchoo/core";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { RouteName } from "@/shared/router/route-names";
import type { SessionOrganization } from "@/shared/types/session";
import { useAppRegistration } from "../composables/useAppRegistration";
import type { CreateAppInput } from "../services/apps.service";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ organization: SessionOrganization }>();

const router = useRouter();
const { registerApp } = useAppRegistration();

const name = ref("");
const bundleId = ref("");
const platform = ref<CreateAppInput["platform"]>("all");

watch(open, (value) => {
  if (!value) return;
  registerApp.reset();
  name.value = "";
  bundleId.value = "";
  platform.value = "all";
});

const bundleProblem = computed(() =>
  bundleId.value && !isValidBundleId(bundleId.value.trim())
    ? "Use reverse-domain form, for example com.acme.field."
    : null,
);
const ready = computed(
  () =>
    name.value.trim().length > 0 &&
    bundleId.value.trim().length > 0 &&
    !bundleProblem.value &&
    !registerApp.isPending.value,
);

function submit() {
  if (!ready.value) return;
  registerApp.mutate(
    {
      organization_id: props.organization.id,
      app_id: bundleId.value.trim(),
      name: name.value.trim(),
      platform: platform.value,
    },
    {
      onSuccess: (app) => {
        toast.success(
          app.adopted
            ? `${app.name} was already registered; you now manage it.`
            : `${app.name} registered`,
        );
        open.value = false;
        void router.push({ name: RouteName.canvas, params: { appId: app.id } });
      },
    },
  );
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Register an app</DialogTitle>
        <DialogDescription>
          In {{ props.organization.name }}. The CLI creates the release channels on the first
          deploy.
        </DialogDescription>
      </DialogHeader>
      <form id="create-app" novalidate @submit.prevent="submit">
        <FieldGroup class="gap-4">
          <Field>
            <FieldLabel for="app-name">Name</FieldLabel>
            <Input id="app-name" v-model="name" maxlength="120" autofocus />
          </Field>
          <Field :data-invalid="bundleProblem ? true : undefined">
            <FieldLabel for="app-bundle">Bundle identifier</FieldLabel>
            <Input
              id="app-bundle"
              v-model="bundleId"
              class="font-mono"
              placeholder="com.acme.field"
              autocomplete="off"
              spellcheck="false"
            />
            <FieldDescription
              >The primary identifier; more can be added in app settings.</FieldDescription
            >
            <FieldError v-if="bundleProblem">{{ bundleProblem }}</FieldError>
          </Field>
          <Field>
            <FieldLabel for="app-platform">Platforms</FieldLabel>
            <NativeSelect id="app-platform" v-model="platform">
              <NativeSelectOption value="all">Android and iOS</NativeSelectOption>
              <NativeSelectOption value="android">Android</NativeSelectOption>
              <NativeSelectOption value="ios">iOS</NativeSelectOption>
            </NativeSelect>
          </Field>
          <ErrorNotice v-if="registerApp.error.value" :error="registerApp.error.value" />
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button type="submit" form="create-app" :disabled="!ready">
          <Spinner v-if="registerApp.isPending.value" />
          Register
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
