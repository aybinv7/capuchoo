<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import TerminalWindow from "@/components/ui/TerminalWindow.vue";
import { CLI_EXAMPLES } from "@/content/cli";
import { vReveal } from "@/directives/reveal";
import { cn } from "@/lib/utils";

const activeId = ref(CLI_EXAMPLES[0]!.id);
const active = computed(
  () => CLI_EXAMPLES.find((example) => example.id === activeId.value) ?? CLI_EXAMPLES[0]!,
);
const tabs = useTemplateRef<HTMLButtonElement[]>("tabs");

function onKey(event: KeyboardEvent, index: number) {
  const step =
    event.key === "ArrowDown" || event.key === "ArrowRight"
      ? 1
      : event.key === "ArrowUp" || event.key === "ArrowLeft"
        ? -1
        : 0;
  if (!step) return;
  event.preventDefault();
  const next = (index + step + CLI_EXAMPLES.length) % CLI_EXAMPLES.length;
  activeId.value = CLI_EXAMPLES[next]!.id;
  tabs.value?.[next]?.focus();
}
</script>

<template>
  <section id="cli" class="bg-ink text-ink-foreground relative overflow-hidden px-6 py-24">
    <div
      aria-hidden="true"
      class="bg-primary/20 pointer-events-none absolute top-0 right-0 size-[30rem] rounded-full blur-[110px]"
    />
    <div class="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
      <div>
        <SectionHeading
          tone="ink"
          align="left"
          eyebrow="CLI first"
          title="Everything the dashboard does,"
          accent="from a terminal."
          lead="The same checks apply to every command. Add --json for scripts, -y for CI, and --dry-run to build and package without uploading."
        />
        <div
          v-reveal
          role="tablist"
          aria-label="CLI examples"
          aria-orientation="vertical"
          class="space-y-1.5"
        >
          <button
            v-for="(example, index) in CLI_EXAMPLES"
            :id="`cli-tab-${example.id}`"
            ref="tabs"
            :key="example.id"
            type="button"
            role="tab"
            :aria-selected="example.id === activeId"
            :aria-controls="`cli-panel`"
            :tabindex="example.id === activeId ? 0 : -1"
            :class="
              cn(
                'flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                example.id === activeId
                  ? 'border-primary/40 bg-ink-raised'
                  : 'border-transparent hover:border-ink-border hover:bg-ink-raised/60',
              )
            "
            @click="activeId = example.id"
            @keydown="onKey($event, index)"
          >
            <span
              :class="
                cn(
                  'text-sm font-medium',
                  example.id === activeId ? 'text-ink-foreground' : 'text-ink-muted',
                )
              "
              >{{ example.label }}</span
            >
            <span v-if="example.id === activeId" class="text-ink-muted text-xs leading-relaxed">{{
              example.summary
            }}</span>
          </button>
        </div>
      </div>
      <div
        id="cli-panel"
        v-reveal="150"
        role="tabpanel"
        :aria-labelledby="`cli-tab-${activeId}`"
        class="w-full"
      >
        <TerminalWindow :lines="active.lines" :title="`capuchoo · ${active.label.toLowerCase()}`" />
      </div>
    </div>
  </section>
</template>
