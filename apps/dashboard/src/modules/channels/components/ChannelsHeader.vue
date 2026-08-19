<template>
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
      <h1 class="text-3xl font-heading font-bold">Channels</h1>
      <p class="text-muted-foreground">
        Manage your deployment channels (e.g., Production, Staging, Dev).
      </p>
    </div>

    <div class="flex gap-2">
      <Button @click="$router.push('/channels/create')">
        <ILucidePlus class="h-4 w-4 mr-2" />
        Create Channel
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>
