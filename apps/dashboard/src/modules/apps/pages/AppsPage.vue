<script setup lang="ts">
import { Building2, LayoutGrid, Plus, Search } from "@lucide/vue";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import GateButton from "@/shared/components/GateButton.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentOrganization } from "@/shared/composables/useCurrentOrganization";
import { useSession } from "@/shared/composables/useSession";
import { canCreateApp } from "@/shared/lib/roles";
import AppCard from "../components/AppCard.vue";
import CreateAppDialog from "../components/CreateAppDialog.vue";
import CreateOrganizationDialog from "../components/CreateOrganizationDialog.vue";

const { apps, isPending } = useSession();
const { organization, role } = useCurrentOrganization();

const search = ref("");
const creatingApp = ref(false);
const creatingOrg = ref(false);

const gate = computed(() => canCreateApp(role.value));
const visible = computed(() => {
  const term = search.value.trim().toLowerCase();
  return apps.value.filter(
    (app) =>
      app.organization_id === organization.value?.id &&
      (!term || app.name.toLowerCase().includes(term) || app.app_id.toLowerCase().includes(term)),
  );
});
</script>

<template>
  <PageContainer>
    <PageHeader
      title="Apps"
      :description="organization ? `Apps of ${organization.name} you can reach.` : undefined"
    >
      <template #actions>
        <Button variant="outline" @click="creatingOrg = true">
          <Building2 />
          New organization
        </Button>
        <GateButton v-if="organization" :gate="gate" @click="creatingApp = true">
          <Plus />
          Register app
        </GateButton>
      </template>
    </PageHeader>

    <InputGroup v-if="apps.length > 6" class="max-w-sm">
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput v-model="search" placeholder="Filter by name or bundle id" />
    </InputGroup>

    <div v-if="isPending" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="index in 6" :key="index" class="h-32 rounded-lg" />
    </div>
    <EmptyState
      v-else-if="!organization"
      :icon="Building2"
      title="No organization yet"
      description="Create one, or ask an admin to invite you to theirs."
    >
      <Button @click="creatingOrg = true">New organization</Button>
    </EmptyState>
    <EmptyState
      v-else-if="visible.length === 0"
      :icon="LayoutGrid"
      :title="search ? 'No app matches' : 'No apps here yet'"
      :description="
        search
          ? 'Try another name or bundle identifier.'
          : 'Register an app, or run capuchoo init in its repository.'
      "
    />
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AppCard v-for="app in visible" :key="app.id" :app="app" />
    </div>

    <CreateAppDialog v-if="organization" v-model:open="creatingApp" :organization="organization" />
    <CreateOrganizationDialog v-model:open="creatingOrg" />
  </PageContainer>
</template>
