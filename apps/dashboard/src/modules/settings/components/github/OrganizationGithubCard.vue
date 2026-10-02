<script setup lang="ts">
import { Plus, SquareArrowOutUpRight, Unlink } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { RouteName } from "@/shared/router/route-names";
import type { GithubInstallation } from "@/shared/types/ci";
import { useOrganizationGithub } from "../../composables/useOrganizationGithub";
import SettingsSection from "../SettingsSection.vue";

const props = defineProps<{ organizationId: string; organizationName: string }>();

const route = useRoute();
const { github, install, unlink } = useOrganizationGithub(() => props.organizationId);
const unlinking = ref<GithubInstallation | null>(null);
const confirmOpen = ref(false);

const value = computed(() => github.data.value ?? null);
const canManage = computed(() => value.value?.can_manage ?? false);

const SELECTION = { all: "All repositories", selected: "Selected repositories" } as const;

function askUnlink(installation: GithubInstallation) {
  unlinking.value = installation;
  confirmOpen.value = true;
}

function runUnlink() {
  const target = unlinking.value;
  if (!target) return;
  unlink.mutate(target.id, {
    onSuccess: () => {
      confirmOpen.value = false;
      toast.success(`${target.account_login} unlinked`);
    },
  });
}
</script>

<template>
  <SettingsSection
    title="GitHub"
    description="Installations of the instance's GitHub App that this organization's apps can use. Each was verified against the GitHub account of the person who linked it."
  >
    <template v-if="canManage && value?.app.configured" #actions>
      <Button
        size="sm"
        variant="outline"
        :disabled="install.isPending.value"
        @click="install.mutate(route.path)"
      >
        <Spinner v-if="install.isPending.value" />
        <Plus v-else />
        Install on GitHub
      </Button>
    </template>

    <ErrorNotice v-if="github.error.value" :error="github.error.value" :retry="github.refetch" />
    <Skeleton v-else-if="github.isPending.value" class="h-24 w-full" />
    <p v-else-if="!value?.app.configured" class="text-muted-foreground text-sm">
      This Capuchoo has no GitHub App yet. An instance administrator creates it in
      <RouterLink :to="{ name: RouteName.githubApp }" class="text-primary hover:underline"
        >GitHub App settings</RouterLink
      >.
    </p>
    <p v-else-if="value.installations.length === 0" class="text-muted-foreground text-sm">
      Not installed on any GitHub account yet.
      <template v-if="!canManage"> An organization admin installs it.</template>
    </p>
    <ul v-else class="divide-y rounded-md border">
      <li
        v-for="installation in value.installations"
        :key="installation.id"
        class="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
      >
        <Avatar class="size-8 rounded-md">
          <AvatarFallback class="rounded-md font-mono text-xs uppercase">{{
            installation.account_login.slice(0, 1)
          }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2 font-medium">
            <span class="truncate font-mono">{{ installation.account_login }}</span>
            <span
              v-if="installation.suspended_at"
              class="bg-warning-soft text-warning rounded px-1.5 text-[10px] font-medium uppercase"
              >suspended</span
            >
          </p>
          <p class="text-muted-foreground text-xs">
            {{ installation.account_type === "Organization" ? "Organization" : "User" }}
            <template v-if="installation.repository_selection">
              · {{ SELECTION[installation.repository_selection] }}</template
            >
            · linked <RelativeTime :value="installation.created_at" />
          </p>
        </div>
        <Button as-child variant="ghost" size="sm">
          <a :href="installation.html_url" target="_blank" rel="noopener noreferrer">
            <ProviderIcon provider="github" />
            Manage
            <SquareArrowOutUpRight class="size-3.5" />
          </a>
        </Button>
        <Button
          v-if="canManage"
          variant="ghost"
          size="icon-sm"
          :aria-label="`Unlink ${installation.account_login}`"
          @click="askUnlink(installation)"
        >
          <Unlink />
        </Button>
      </li>
    </ul>
    <ErrorNotice v-if="install.error.value" :error="install.error.value" class="mt-3" />
  </SettingsSection>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="`Unlink ${unlinking?.account_login ?? 'installation'}`"
    :description="`Apps of ${props.organizationName} connected through it stop recording and starting runs. The App stays installed on GitHub; uninstall it there to remove its access.`"
    confirm-label="Unlink"
    destructive
    :pending="unlink.isPending.value"
    :error="unlink.error.value"
    @confirm="runUnlink"
  />
</template>
