<script setup lang="ts">
import { Check, Lock, Search } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import type { GithubInstallation, GithubRepository } from "@/shared/types/ci";
import { useGithubRepositories } from "../../composables/useGithubRepositories";

const props = defineProps<{
  organizationId: string;
  installations: readonly GithubInstallation[];
  pending: boolean;
  error: unknown;
}>();
const emit = defineEmits<{ connect: [input: { installation: string; repository_id: number }] }>();

const usable = computed(() => props.installations.filter((entry) => !entry.suspended_at));
const installationId = ref<string>(usable.value[0]?.id ?? "");
const search = ref("");
const selected = ref<GithubRepository | null>(null);

watch(usable, (list) => {
  if (!list.some((entry) => entry.id === installationId.value))
    installationId.value = list[0]?.id ?? "";
});
watch(installationId, () => {
  selected.value = null;
  search.value = "";
});

const repositories = useGithubRepositories(() => props.organizationId, installationId, search);
const list = computed(() => repositories.data.value?.repositories ?? []);

function connect() {
  if (!selected.value || !installationId.value) return;
  emit("connect", { installation: installationId.value, repository_id: selected.value.id });
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
      <Field>
        <FieldLabel for="gh-installation">Account</FieldLabel>
        <NativeSelect id="gh-installation" v-model="installationId">
          <NativeSelectOption v-for="entry in usable" :key="entry.id" :value="entry.id">
            {{ entry.account_login }}
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel for="gh-repo-search">Repository</FieldLabel>
        <InputGroup>
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput
            id="gh-repo-search"
            v-model="search"
            placeholder="Search repositories"
            autocomplete="off"
            spellcheck="false"
          />
          <InputGroupAddon v-if="repositories.isFetching.value" align="inline-end">
            <Spinner class="size-3.5" />
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </div>

    <ErrorNotice
      v-if="repositories.error.value"
      :error="repositories.error.value"
      :retry="repositories.refetch"
    />
    <div v-else-if="repositories.isPending.value" class="space-y-1.5">
      <Skeleton v-for="index in 4" :key="index" class="h-10 w-full" />
    </div>
    <p
      v-else-if="list.length === 0"
      class="text-muted-foreground rounded-md border border-dashed p-4 text-sm"
    >
      {{
        search.trim()
          ? "No repository matches. The installation may not include it; change its repository access on GitHub."
          : "This installation reaches no repository yet."
      }}
    </p>
    <ul
      v-else
      role="listbox"
      aria-label="Repositories"
      class="max-h-72 divide-y overflow-y-auto rounded-md border"
    >
      <li
        v-for="repo in list"
        :key="repo.id"
        role="option"
        :aria-selected="selected?.id === repo.id"
      >
        <button
          type="button"
          :class="
            cn(
              'hover:bg-accent/50 focus-visible:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left text-sm outline-none',
              selected?.id === repo.id && 'bg-primary/5',
            )
          "
          @click="selected = repo"
        >
          <Check
            :class="cn('size-4 shrink-0', selected?.id === repo.id ? 'text-primary' : 'invisible')"
          />
          <span class="min-w-0 flex-1 truncate font-mono">{{ repo.full_name }}</span>
          <Lock v-if="repo.private" class="text-muted-foreground size-3.5" aria-label="Private" />
          <span class="text-muted-foreground hidden shrink-0 text-xs sm:inline">
            <RelativeTime :value="repo.pushed_at" />
          </span>
        </button>
      </li>
    </ul>
    <p v-if="repositories.data.value?.truncated" class="text-muted-foreground text-xs">
      Showing the first results; search to narrow them down.
    </p>

    <ErrorNotice v-if="props.error" :error="props.error" />
    <div class="flex items-center justify-between gap-3">
      <p class="text-muted-foreground min-w-0 truncate text-xs">
        <template v-if="selected">
          Workflow runs from <span class="font-mono">{{ selected.default_branch }}</span> report
          here.
        </template>
      </p>
      <Button :disabled="!selected || props.pending" @click="connect">
        <Spinner v-if="props.pending" />
        Connect repository
      </Button>
    </div>
  </div>
</template>
