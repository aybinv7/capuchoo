<template>
  <F7Page>
    <F7Navbar :title="t('errors.notFoundTitle')" />
    <F7Block strong class="text-center">
      <p class="m-0">{{ t("errors.notFound") }}</p>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>
