<script setup lang="ts">
import { CircleCheck, CircleDashed, SquareArrowOutUpRight } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import CopyField from "@/shared/components/CopyField.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import { queryKeys } from "@/shared/api/query-keys";
import { RouteName } from "@/shared/router/route-names";
import GithubManifestForm from "../components/github/GithubManifestForm.vue";
import SettingsSection from "../components/SettingsSection.vue";
import { useGithubApp } from "../composables/useGithubApp";
import { useGithubReturnNotice } from "../composables/useGithubReturnNotice";

const client = useQueryClient();
const { status, remove } = useGithubApp();
const confirmRemove = ref(false);
const app = computed(() => status.data.value ?? null);

useGithubReturnNotice(() => void client.invalidateQueries({ queryKey: queryKeys.githubApp() }));

function runRemove() {
  remove.mutate(undefined, {
    onSuccess: () => {
      confirmRemove.value = false;
      toast.success("GitHub App removed from Capuchoo");
    },
  });
}
</script>

<template>
  <PageContainer width="narrow">
    <PageHeader
      title="GitHub App"
      description="One GitHub App serves this whole Capuchoo instance. Organizations install it on their GitHub accounts; apps then connect a repository in their CI settings."
    />

    <ErrorNotice v-if="status.error.value" :error="status.error.value" :retry="status.refetch" />
    <Skeleton v-else-if="status.isPending.value || !app" class="h-48 w-full" />

    <template v-else-if="app.configured">
      <SettingsSection :title="app.name ?? app.slug ?? 'GitHub App'">
        <template #actions>
          <span class="text-success flex items-center gap-1.5 text-sm">
            <CircleCheck class="size-4" />
            {{ app.source === "env" ? "Configured by environment" : "Created from the dashboard" }}
          </span>
        </template>
        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">Owner</dt>
            <dd class="font-mono">{{ app.owner ?? "—" }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">Slug</dt>
            <dd class="font-mono">{{ app.slug ?? "—" }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-muted-foreground mb-1.5 text-xs">Webhook URL</dt>
            <dd><CopyField :value="app.webhook_url" label="Webhook URL" /></dd>
          </div>
        </dl>
        <p v-if="app.source === 'env'" class="text-muted-foreground mt-4 text-sm text-pretty">
          The GITHUB_APP_* environment variables define this App; they override anything stored.
          Change it by changing them.
        </p>
        <template #footer>
          <Button v-if="app.html_url" as-child variant="outline" size="sm">
            <a :href="app.html_url" target="_blank" rel="noopener noreferrer">
              <ProviderIcon provider="github" />
              Open on GitHub
              <SquareArrowOutUpRight class="size-3.5" />
            </a>
          </Button>
          <Button as-child variant="outline" size="sm">
            <RouterLink :to="{ name: RouteName.organization }"
              >Install for an organization</RouterLink
            >
          </Button>
          <Button
            v-if="app.can_manage && app.source === 'database'"
            variant="destructive"
            size="sm"
            @click="confirmRemove = true"
            >Remove</Button
          >
        </template>
      </SettingsSection>
    </template>

    <SettingsSection
      v-else
      title="Create the GitHub App"
      description="GitHub registers the App from a manifest and hands its keys back to this server, which stores them encrypted. Nothing is copied by hand."
    >
      <template #actions>
        <span class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CircleDashed class="size-4" />
          Not configured
        </span>
      </template>
      <GithubManifestForm v-if="app.can_manage" />
      <p v-else class="text-muted-foreground text-sm">
        Only an instance administrator can create it.
      </p>
    </SettingsSection>

    <ConfirmDialog
      v-model:open="confirmRemove"
      title="Remove the GitHub App from Capuchoo"
      description="Every organization loses its GitHub connection until a new App is created. The App itself stays on GitHub; delete it there too."
      confirm-label="Remove"
      destructive
      require-text="remove"
      :pending="remove.isPending.value"
      :error="remove.error.value"
      @confirm="runRemove"
    />
  </PageContainer>
</template>
