<template>
  <Button
    variant="ghost"
    size="icon"
    @click="mode === 'light' ? (mode = 'dark') : (mode = 'light')"
  >
    <ILucideMoon
      class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
    />
    <ILucideSun
      class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
    />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
<script setup lang="ts">
const mode = useColorMode({
  disableTransition: false,
})
</script>
