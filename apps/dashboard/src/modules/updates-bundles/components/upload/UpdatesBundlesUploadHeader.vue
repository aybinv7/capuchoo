<template>
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
      <h1 class="text-3xl font-heading font-bold">New Release</h1>
      <p class="text-muted-foreground">Deploy a new version to your users across platforms.</p>
    </div>

    <div class="flex gap-2">
      <Button
        @click="emit('click:upload')"
        type="submit"
        class="w-full"
        size="lg"
        :disabled="isUploading"
      >
        <template v-if="isUploading">
          <ILucideLoader2 class="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </template>
        <template v-else>
          <ILucideRocket class="mr-2 h-4 w-4" />
          Deploy Release
        </template>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isUploading } = defineProps<{
  isUploading: boolean
}>()

const emit = defineEmits(['click:upload'])
</script>
