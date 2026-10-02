<script setup lang="ts">
import { Check, ChevronsUpDown, CornerDownLeft, GitBranch, Tag } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { CiRefs } from "../../types/ci";

const model = defineModel<string>({ required: true });

const props = defineProps<{
  refs: CiRefs | null;
  loading: boolean;
  invalid?: boolean;
  id?: string;
}>();

const VISIBLE = 60;

const open = ref(false);
const search = ref("");

watch(open, (value) => {
  if (value) search.value = "";
});

const isTag = computed(() => props.refs?.tags.includes(model.value) ?? false);

function matching(list: readonly string[]): string[] {
  const query = search.value.trim().toLowerCase();
  const found = query ? list.filter((name) => name.toLowerCase().includes(query)) : list;
  return found.slice(0, VISIBLE);
}

const branches = computed(() => {
  const list = props.refs?.branches ?? [];
  const head = props.refs?.default_branch;
  const ordered =
    head && list.includes(head) ? [head, ...list.filter((name) => name !== head)] : list;
  return matching(ordered);
});
const tags = computed(() => matching(props.refs?.tags ?? []));
const custom = computed(() => {
  const typed = search.value.trim();
  if (!typed) return null;
  const known = props.refs?.branches.includes(typed) || props.refs?.tags.includes(typed);
  return known ? null : typed;
});

function choose(value: string) {
  model.value = value;
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="props.id"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :aria-invalid="props.invalid || undefined"
        class="w-full justify-between font-mono font-normal"
      >
        <span class="flex min-w-0 items-center gap-2">
          <Tag v-if="isTag" class="text-muted-foreground size-3.5" />
          <GitBranch v-else class="text-muted-foreground size-3.5" />
          <span v-if="model" class="truncate">{{ model }}</span>
          <span v-else class="text-muted-foreground font-sans">Branch or tag</span>
        </span>
        <Spinner v-if="props.loading" class="size-3.5" />
        <ChevronsUpDown v-else class="text-muted-foreground size-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) min-w-72 p-0" align="start">
      <Command>
        <CommandInput
          placeholder="Filter branches and tags"
          class="h-9 font-mono"
          @update:model-value="search = String($event ?? '')"
        />
        <CommandList class="max-h-72">
          <CommandEmpty>
            {{ props.loading ? "Loading refs…" : "Nothing matches. Type a full ref to use it." }}
          </CommandEmpty>
          <CommandGroup v-if="custom">
            <CommandItem :value="`custom:${custom}`" class="py-1.5" @select="choose(custom)">
              <CornerDownLeft class="size-3.5" />
              Use <span class="font-mono">{{ custom }}</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup v-if="branches.length" heading="Branches">
            <CommandItem
              v-for="name in branches"
              :key="`b:${name}`"
              :value="`branch:${name}`"
              class="py-1.5"
              @select="choose(name)"
            >
              <GitBranch class="size-3.5" />
              <span class="truncate font-mono">{{ name }}</span>
              <span
                v-if="name === props.refs?.default_branch"
                class="text-muted-foreground rounded border px-1 text-[10px]"
                >default</span
              >
              <Check
                :class="cn('ml-auto size-3.5', model === name ? 'opacity-100' : 'opacity-0')"
              />
            </CommandItem>
          </CommandGroup>
          <CommandGroup v-if="tags.length" heading="Tags">
            <CommandItem
              v-for="name in tags"
              :key="`t:${name}`"
              :value="`tag:${name}`"
              class="py-1.5"
              @select="choose(name)"
            >
              <Tag class="size-3.5" />
              <span class="truncate font-mono">{{ name }}</span>
              <Check
                :class="cn('ml-auto size-3.5', model === name ? 'opacity-100' : 'opacity-0')"
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
