<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { RouteName } from "@/shared/router/route-names";
import { useCiConnection } from "../../composables/useCiConnection";
import { useGithubApp } from "../../composables/useGithubApp";
import { useOrganizationGithub } from "../../composables/useOrganizationGithub";
import GithubManifestForm from "./GithubManifestForm.vue";
import GithubRepoPicker from "./GithubRepoPicker.vue";

const route = useRoute();
const { appId, organization } = useCurrentApp();
const organizationId = computed(() => organization.value?.id ?? "");
const { github, install } = useOrganizationGithub(organizationId);
const { status: appStatus } = useGithubApp();
const { connect } = useCiConnection(appId);

const configured = computed(() => github.data.value?.app.configured ?? false);
const installations = computed(() => github.data.value?.installations ?? []);
const usable = computed(() => installations.value.filter((entry) => !entry.suspended_at));
const canInstall = computed(() => github.data.value?.can_manage ?? false);
const instanceAdmin = computed(() => appStatus.data.value?.can_manage ?? false);

function startInstall() {
  install.mutate(route.path);
}

function runConnect(input: { installation: string; repository_id: number }) {
  connect.mutate(input, {
    onSuccess: (ci) => toast.success(`Connected to ${ci.github?.repository.full_name ?? "GitHub"}`),
  });
}
</script>

<template>
  <ErrorNotice v-if="github.error.value" :error="github.error.value" :retry="github.refetch" />
  <Skeleton v-else-if="github.isPending.value" class="h-40 w-full" />

  <div v-else-if="!configured" class="space-y-4">
    <div class="space-y-1.5 text-sm">
      <p class="font-medium">This Capuchoo has no GitHub App yet</p>
      <p class="text-muted-foreground text-pretty">
        One App per Capuchoo instance lets every organization record runs, start them and set
        repositories up, with short-lived tokens instead of personal ones. Creating it takes one
        round trip to GitHub.
      </p>
    </div>
    <GithubManifestForm v-if="instanceAdmin" />
    <p v-else class="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
      Ask an instance administrator to create it from
      <RouterLink :to="{ name: RouteName.githubApp }" class="text-primary hover:underline"
        >GitHub App settings</RouterLink
      >.
    </p>
  </div>

  <div v-else-if="usable.length === 0" class="space-y-4">
    <div class="space-y-1.5 text-sm">
      <p class="font-medium">
        Install the App on the GitHub account that owns {{ organization?.name ?? "your" }}'s
        repositories
      </p>
      <p class="text-muted-foreground text-pretty">
        GitHub asks which repositories it may reach; you come back here to pick one.
        <template v-if="installations.length">
          The linked installation is suspended on GitHub.
        </template>
      </p>
    </div>
    <Button v-if="canInstall" :disabled="install.isPending.value" @click="startInstall">
      <Spinner v-if="install.isPending.value" />
      <ProviderIcon v-else provider="github" />
      Install on GitHub
    </Button>
    <p v-else class="text-muted-foreground text-sm">
      An admin of {{ organization?.name ?? "the organization" }} installs it.
    </p>
    <ErrorNotice v-if="install.error.value" :error="install.error.value" />
  </div>

  <div v-else class="space-y-3">
    <GithubRepoPicker
      :organization-id="organizationId"
      :installations="installations"
      :pending="connect.isPending.value"
      :error="connect.error.value"
      @connect="runConnect"
    />
    <Button
      v-if="canInstall"
      variant="link"
      size="sm"
      class="h-auto px-0"
      :disabled="install.isPending.value"
      @click="startInstall"
    >
      <Plus />
      Install on another account or change repository access
    </Button>
  </div>
</template>
