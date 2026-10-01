<template>
  <label class="search-bar">
    <F7Icon md="material:search" size="24" class="text-muted-foreground" />
    <input v-model="model" type="search" :placeholder="placeholder" enterkeyhint="search" class="min-w-0 flex-1" />
    <button v-if="model" type="button" class="search-clear" :aria-label="clearLabel" @click="model = ''">
      <F7Icon md="material:close" size="20" />
    </button>
  </label>
</template>

<script setup lang="ts">
/** The M3 search bar: a 56dp full-round field on the high container, leading icon, trailing clear. */
defineProps<{ placeholder: string; clearLabel: string }>();
const model = defineModel<string>({ required: true });
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding-inline: 16px;
  border-radius: 999px;
  background: var(--m3-surface-container-high);
  color: var(--foreground);
}

.search-bar input {
  height: 100%;
  font-size: 16px;
  color: inherit;
  background: transparent;
}

.search-bar input::placeholder {
  color: var(--muted-foreground);
}

.search-clear {
  display: grid;
  place-items: center;
  width: 40px !important;
  height: 40px;
  margin-inline-end: -8px;
  border-radius: 999px;
  color: var(--muted-foreground);
}
</style>
