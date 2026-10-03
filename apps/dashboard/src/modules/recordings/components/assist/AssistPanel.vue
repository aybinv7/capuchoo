<script setup lang="ts">
import type { AssistControl, AssistKey } from "@capuchoo/core";
import { CornerDownLeft, Delete, Hand, MousePointer2, SendHorizontal } from "@lucide/vue";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { formatClock } from "@/shared/lib/format";
import type { AssistNotice, AssistPhase } from "../../types/assist.types";

const props = defineProps<{
  phase: AssistPhase;
  control: AssistControl;
  notices: readonly AssistNotice[];
}>();
const emit = defineEmits<{
  requestControl: [];
  releaseControl: [];
  type: [text: string];
  key: [key: AssistKey];
}>();

const draft = ref("");

function sendText() {
  const text = draft.value;
  if (!text) return;
  emit("type", text);
  draft.value = "";
}

const KEYS: Array<{ key: AssistKey; label: string }> = [
  { key: "Enter", label: "Enter" },
  { key: "Backspace", label: "⌫" },
  { key: "Tab", label: "Tab" },
  { key: "Escape", label: "Esc" },
];

const TONES: Record<AssistNotice["tone"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-destructive",
};
</script>

<template>
  <aside class="flex min-h-0 flex-col" aria-label="Assist controls">
    <section class="space-y-3 border-b p-4">
      <h2 class="text-sm font-semibold">Control</h2>
      <p class="text-muted-foreground text-xs text-pretty">
        <template v-if="props.control === 'granted'">
          Click on the screen to tap, scroll with the wheel, and type below. The user sees every tap
          and can take control back at any time.
        </template>
        <template v-else>
          Move over the screen to point: the user sees your pointer. To tap and type for them, ask
          for control - they decide on their phone.
        </template>
      </p>
      <Button
        v-if="props.control === 'granted'"
        variant="outline"
        size="sm"
        class="w-full"
        @click="emit('releaseControl')"
      >
        <MousePointer2 />
        Give control back
      </Button>
      <Button v-else-if="props.control === 'asked'" size="sm" class="w-full" disabled>
        <Spinner class="size-3.5" />
        Waiting for the user
      </Button>
      <Button
        v-else
        size="sm"
        class="w-full"
        :disabled="props.phase !== 'live'"
        @click="emit('requestControl')"
      >
        <Hand />
        {{ props.control === "denied" ? "Ask for control again" : "Ask for control" }}
      </Button>
    </section>

    <section v-if="props.control === 'granted'" class="space-y-2 border-b p-4">
      <h2 class="text-sm font-semibold">Keyboard</h2>
      <p class="text-muted-foreground text-xs">Tap a field on the screen first.</p>
      <form @submit.prevent="sendText">
        <InputGroup class="h-8">
          <InputGroupInput
            v-model="draft"
            placeholder="Type into the app"
            aria-label="Text to type into the app"
            maxlength="500"
            class="text-sm"
          />
          <InputGroupAddon align="inline-end">
            <Button type="submit" variant="ghost" size="icon-xs" aria-label="Send the text">
              <SendHorizontal />
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <ButtonGroup class="w-full" aria-label="Keys">
        <Button
          v-for="entry in KEYS"
          :key="entry.key"
          variant="outline"
          size="sm"
          class="flex-1 font-mono text-xs"
          :aria-label="entry.key"
          @click="emit('key', entry.key)"
        >
          <CornerDownLeft v-if="entry.key === 'Enter'" />
          <Delete v-else-if="entry.key === 'Backspace'" />
          <template v-else>{{ entry.label }}</template>
        </Button>
      </ButtonGroup>
    </section>

    <section class="flex min-h-0 flex-1 flex-col p-4">
      <h2 class="mb-2 text-sm font-semibold">What happened</h2>
      <ol v-if="props.notices.length" class="min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
        <li v-for="notice in props.notices" :key="notice.id" class="flex gap-2">
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full" :class="TONES[notice.tone]" />
          <span class="min-w-0 flex-1 text-pretty">{{ notice.text }}</span>
          <time class="text-muted-foreground tabular shrink-0">{{
            formatClock(new Date(notice.at).toISOString())
          }}</time>
        </li>
      </ol>
      <p v-else class="text-muted-foreground text-xs">Nothing yet.</p>
    </section>
  </aside>
</template>
