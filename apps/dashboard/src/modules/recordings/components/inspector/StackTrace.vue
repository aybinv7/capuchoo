<script setup lang="ts">
import { FileCode2, Library } from "@lucide/vue";
import { computed, ref } from "vue";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useSymbolicatedStack } from "../../composables/useSymbolicatedStack";
import type { ResolvedFrame } from "../../lib/stack";

const props = withDefaults(
  defineProps<{ appId: string; version: string; stack: string; label?: string }>(),
  { label: "Stack" },
);

const { frames, state } = useSymbolicatedStack({
  appId: () => props.appId,
  version: () => props.version,
  stack: () => props.stack,
});

const view = ref<"original" | "minified">("original");
const expanded = ref(new Set<number>());

type Group =
  | { kind: "frame"; id: number; frame: ResolvedFrame }
  | { kind: "library"; id: number; frames: ResolvedFrame[] };

const groups = computed<Group[]>(() => {
  const result: Group[] = [];
  frames.value.forEach((frame, index) => {
    const last = result[result.length - 1];
    if (!frame.library) result.push({ kind: "frame", id: index, frame });
    else if (last?.kind === "library") last.frames.push(frame);
    else result.push({ kind: "library", id: index, frames: [frame] });
  });
  return result;
});

const showOriginal = computed(() => state.value === "ready" && view.value === "original");

const firstWithCode = computed(() =>
  frames.value.findIndex((frame) => !frame.library && frame.original?.context),
);
const opened = ref<Set<number> | null>(null);
const openFrames = computed(
  () => opened.value ?? new Set(firstWithCode.value >= 0 ? [firstWithCode.value] : []),
);

function toggleCode(id: number) {
  const next = new Set(openFrames.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  opened.value = next;
}

function toggle(id: number) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function label(frame: ResolvedFrame): string {
  return frame.original?.name ?? frame.fn ?? "anonymous";
}

function where(frame: ResolvedFrame): string {
  if (frame.original) {
    return `${frame.original.source}:${frame.original.line}:${frame.original.column}`;
  }
  return frame.url ? `${frame.url}:${frame.line}:${frame.column}` : frame.raw;
}
</script>

<template>
  <section class="space-y-2" :aria-label="props.label">
    <header class="flex items-center gap-2">
      <span class="text-muted-foreground text-[11px] font-medium">{{ props.label }}</span>
      <span
        v-if="state === 'loading'"
        class="text-muted-foreground flex items-center gap-1.5 text-[11px]"
      >
        <Spinner class="size-3" /> Reading source maps
      </span>
      <ToggleGroup
        v-else-if="state === 'ready'"
        v-model="view"
        type="single"
        size="sm"
        variant="outline"
        class="ml-auto h-6"
        aria-label="Stack view"
      >
        <ToggleGroupItem value="original" class="h-6 px-2 text-[11px]">Original</ToggleGroupItem>
        <ToggleGroupItem value="minified" class="h-6 px-2 text-[11px]">Minified</ToggleGroupItem>
      </ToggleGroup>
    </header>

    <ol v-if="showOriginal" class="bg-muted/40 divide-border/60 divide-y rounded border">
      <template v-for="group in groups" :key="group.id">
        <li v-if="group.kind === 'frame'">
          <button
            type="button"
            class="hover:bg-accent/50 block w-full space-y-0.5 px-2 py-1.5 text-left disabled:cursor-default disabled:hover:bg-transparent"
            :disabled="!group.frame.original?.context"
            :aria-expanded="group.frame.original?.context ? openFrames.has(group.id) : undefined"
            @click="toggleCode(group.id)"
          >
            <span class="flex items-center gap-1.5 font-mono text-[11px] font-semibold">
              <FileCode2
                :class="
                  cn(
                    'size-3 shrink-0',
                    group.frame.original ? 'text-primary' : 'text-muted-foreground',
                  )
                "
                aria-hidden="true"
              />
              {{ label(group.frame) }}
            </span>
            <span
              class="text-muted-foreground block truncate pl-[18px] font-mono text-[10px]"
              :title="group.frame.raw"
            >
              {{ where(group.frame) }}
            </span>
          </button>
          <pre
            v-if="group.frame.original?.context && openFrames.has(group.id)"
            class="bg-background/60 overflow-x-auto border-t py-1 font-mono text-[10.5px] leading-[1.55]"
          ><code><span
            v-for="(text, offset) in group.frame.original.context.lines"
            :key="offset"
            :class="cn(
              'flex',
              group.frame.original.context.start + offset === group.frame.original.line &&
                'bg-destructive/12 text-foreground',
            )"
          ><span class="text-muted-foreground/70 w-10 shrink-0 pr-3 text-right select-none">{{
            group.frame.original.context.start + offset
          }}</span><span class="pr-3 whitespace-pre">{{ text }}</span></span></code></pre>
        </li>
        <li v-else>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px]"
            :aria-expanded="expanded.has(group.id)"
            @click="toggle(group.id)"
          >
            <Library class="size-3" aria-hidden="true" />
            {{ group.frames.length }} library frame{{ group.frames.length === 1 ? "" : "s" }}
          </button>
          <ol v-if="expanded.has(group.id)" class="pb-1">
            <li
              v-for="frame in group.frames"
              :key="frame.raw"
              class="text-muted-foreground truncate px-2 pl-[26px] font-mono text-[10px]"
            >
              {{ label(frame) }} · {{ where(frame) }}
            </li>
          </ol>
        </li>
      </template>
    </ol>
    <pre
      v-else
      class="bg-muted/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
      >{{ props.stack }}</pre>

    <p v-if="state === 'missing'" class="text-muted-foreground text-[11px] text-pretty">
      No source maps for {{ props.version }}. Build with
      <code class="font-mono">build.sourcemap: "hidden"</code> and
      <code class="font-mono">capuchoo deploy ota</code> stores them; they never ship to devices.
    </p>
  </section>
</template>
