<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "./ErrorNotice.vue";

const open = defineModel<boolean>("open", { required: true });

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmLabel: string;
    destructive?: boolean;
    /** When set, the person types this exact text before the confirm button enables. */
    requireText?: string | null;
    pending?: boolean;
    error?: unknown;
    disabled?: boolean;
  }>(),
  { destructive: false, requireText: null, pending: false, disabled: false },
);

const emit = defineEmits<{ confirm: [] }>();

const typed = ref("");
watch(open, (value) => {
  if (value) typed.value = "";
});

const confirmable = computed(
  () =>
    !props.disabled &&
    !props.pending &&
    (!props.requireText || typed.value.trim() === props.requireText),
);
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="sm:max-w-lg">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ props.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="props.description">
          {{ props.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-4">
        <slot />
        <label v-if="props.requireText" class="block space-y-1.5 text-sm">
          <span class="text-muted-foreground">
            Type <code class="text-foreground font-mono">{{ props.requireText }}</code> to confirm
          </span>
          <Input v-model="typed" autocomplete="off" spellcheck="false" class="font-mono" />
        </label>
        <ErrorNotice v-if="props.error" :error="props.error" />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.pending">Cancel</AlertDialogCancel>
        <Button
          :variant="props.destructive ? 'destructive' : 'default'"
          :disabled="!confirmable"
          @click="emit('confirm')"
        >
          <Spinner v-if="props.pending" />
          {{ props.confirmLabel }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
