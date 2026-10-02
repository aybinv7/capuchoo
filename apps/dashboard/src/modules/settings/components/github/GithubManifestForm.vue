<script setup lang="ts">
import { nextTick, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useGithubApp } from "../../composables/useGithubApp";
import { isGithubFormAction } from "../../lib/github-messages";

const ORG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const { manifest } = useGithubApp();
const organization = ref("");
const name = ref("");
const visibility = ref<"private" | "public">("private");
const target = ref<{ action: string; manifest: string } | null>(null);
const form = ref<HTMLFormElement | null>(null);
const problem = ref<string | null>(null);

function setVisibility(value: unknown) {
  if (value === "private" || value === "public") visibility.value = value;
}

function create() {
  problem.value = null;
  const org = organization.value.trim();
  if (org && !ORG.test(org)) {
    problem.value = "That is not a GitHub organization name.";
    return;
  }
  manifest.mutate(
    {
      organization: org || undefined,
      visibility: visibility.value,
      name: name.value.trim() || undefined,
    },
    {
      onSuccess: async (result) => {
        if (!isGithubFormAction(result.action)) {
          problem.value = "The server asked to post the manifest somewhere other than github.com.";
          return;
        }
        target.value = result;
        await nextTick();
        form.value?.submit();
      },
    },
  );
}
</script>

<template>
  <div class="space-y-4">
    <FieldGroup class="gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel for="gh-app-org"
            >GitHub organization
            <span class="text-muted-foreground font-normal">(optional)</span></FieldLabel
          >
          <Input
            id="gh-app-org"
            v-model="organization"
            class="font-mono"
            placeholder="acme"
            autocomplete="off"
            spellcheck="false"
          />
          <FieldDescription
            >Leave empty to own the App with your personal account.</FieldDescription
          >
        </Field>
        <Field>
          <FieldLabel for="gh-app-name"
            >App name <span class="text-muted-foreground font-normal">(optional)</span></FieldLabel
          >
          <Input
            id="gh-app-name"
            v-model="name"
            placeholder="Capuchoo"
            maxlength="34"
            autocomplete="off"
          />
          <FieldDescription>GitHub App names are unique across GitHub.</FieldDescription>
        </Field>
      </div>
      <Field>
        <FieldLabel>Who can install it</FieldLabel>
        <ToggleGroup
          :model-value="visibility"
          type="single"
          variant="outline"
          size="sm"
          class="w-fit"
          @update:model-value="setVisibility"
        >
          <ToggleGroupItem value="private">Only the owner</ToggleGroupItem>
          <ToggleGroupItem value="public">Any account</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>
          {{
            visibility === "private"
              ? "Installable only on the account that owns the App. Right when every repository lives there."
              : "Installable on any GitHub account. Each installation is still verified before an organization can use it."
          }}
        </FieldDescription>
      </Field>
    </FieldGroup>

    <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>
    <ErrorNotice v-if="manifest.error.value" :error="manifest.error.value" />

    <Button :disabled="manifest.isPending.value || Boolean(target)" @click="create">
      <Spinner v-if="manifest.isPending.value || target" />
      <ProviderIcon v-else provider="github" />
      Create GitHub App
    </Button>

    <form v-if="target" ref="form" method="post" :action="target.action" class="hidden">
      <input type="hidden" name="manifest" :value="target.manifest" />
    </form>
  </div>
</template>
