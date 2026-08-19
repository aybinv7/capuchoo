<template>
  <header class="flex flex-row justify-between items-center h-16 shrink-0 gap-2 border-b">
    <div class="flex gap-2 items-center px-4">
      <SidebarTrigger class="-ml-1" />
      <Separator orientation="vertical" class="mr-2 h-4" />
      <Bread class="hidden md:block" />
    </div>

    <Button @click="openCommandPalette" variant="outline" class="w-80 justify-start hidden md:flex">
      <span class="mr-2 text-muted-foreground">
        <SearchCommand class="size-4" />
      </span>
      {{ t('404.search_placeholder') }}
      <span class="ml-auto text-xs text-muted-foreground">
        {{ t('404.press_slash', 'Press /') }}
      </span>
    </Button>

    <div class="flex flex-row items-center gap-2 px-4">
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="relative">
            <ILucideBell class="size-4" />
            <span class="absolute top-2 right-2 size-2 bg-primary rounded-full border"></span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-80 p-0" align="end" :side-offset="4">
          <div class="p-4 border-b flex items-center justify-between">
            <h4 class="text-sm font-semibold">Notifications</h4>
            <Badge variant="outline">3 New</Badge>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div
              v-for="i in 3"
              :key="i"
              class="p-4 border-b last:border-0 hover:bg-accent cursor-pointer"
            >
              <div class="flex gap-2">
                <div class="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <ILucideZap class="size-4" />
                </div>
                <div class="flex flex-col gap-1 min-w-0">
                  <p class="text-sm font-medium leading-none">Deployment Successful</p>
                  <p class="text-xs text-muted-foreground">
                    Latest bundle for Staging was successfully deployed.
                  </p>
                  <span class="text-[10px] text-muted-foreground">{{ i * 15 }}m ago</span>
                </div>
              </div>
            </div>
          </div>
          <div class="p-2 border-t">
            <Button variant="ghost" size="sm" class="w-full text-xs gap-2">
              View all activity
              <ILucideArrowRight class="size-3" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" class="h-4" />

      <div class="flex items-center gap-2">
        <ThemeToggle />
        <Internationalization />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Bread from './Bread.vue'
import SearchCommand from './SearchCommand.vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const { searchCommandRef } = defineProps<{
  searchCommandRef: InstanceType<typeof SearchCommand> | null
}>()

const { t } = useI18n()

const openCommandPalette = () => {
  if (searchCommandRef?.openCommandPalette) {
    searchCommandRef.openCommandPalette()
  }
}
</script>

<style scoped></style>
