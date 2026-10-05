<template>
  <div class="flex items-center gap-3">
    <span
      class="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-secondary-foreground uppercase"
    >
      {{ t("signIn.step", { step, total }) }}
    </span>
    <span class="flex items-center gap-1.5" aria-hidden="true">
      <span
        v-for="index in total"
        :key="index"
        class="h-1.5 rounded-full"
        :class="index <= step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
/** Where the reader is in sign-in, said and drawn, the way the welcome draws its pages. */
defineProps<{ step: number; total: number }>();
const { t } = useI18n();
</script>
