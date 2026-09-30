<script setup lang="ts">
import logo from "@/assets/images/capuchoo.png";

defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="dot-grid bg-surface relative grid min-h-svh place-items-center px-4 py-10">
    <div class="w-full max-w-sm space-y-6">
      <div class="flex flex-col items-center gap-3 text-center">
        <img :src="logo" alt="Capuchoo" class="size-12 rounded-xl object-contain" />
        <div class="space-y-1">
          <h1 class="text-xl font-semibold tracking-tight">{{ title }}</h1>
          <p v-if="subtitle" class="text-muted-foreground text-sm text-pretty">
            {{ subtitle }}
          </p>
        </div>
      </div>
      <div class="bg-card rounded-xl border p-6 shadow-sm">
        <slot />
      </div>
      <p class="text-muted-foreground text-center text-xs">
        <slot name="footer">Over-the-air and native releases for Capacitor apps.</slot>
      </p>
    </div>
  </div>
</template>
