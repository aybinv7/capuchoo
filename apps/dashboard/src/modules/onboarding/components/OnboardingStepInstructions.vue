<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight">Integration Guide</h1>
      <p class="text-muted-foreground">
        Follow these steps to integrate Capgo into your {{ store.currentApp?.name }} app.
      </p>
    </div>

    <div class="w-full">
      <Tabs default-value="install" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="install">1. Install SDK</TabsTrigger>
          <TabsTrigger value="upload">2. Upload Bundle</TabsTrigger>
        </TabsList>

        <TabsContent value="install" class="space-y-4 border rounded-lg p-4 mt-2 bg-background/50">
          <div class="space-y-2">
            <h3 class="font-medium">Install the Capacitor Plugin</h3>
            <p class="text-sm text-muted-foreground">
              Run the following command in your project root:
            </p>
            <div
              class="bg-black/90 text-white rounded-md p-3 font-mono text-xs relative group text-left"
            >
              <code>npm install @capgo/capacitor-updater && npx cap sync</code>
              <Button
                variant="ghost"
                size="icon"
                class="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-white"
                @click="copy('npm install @capgo/capacitor-updater && npx cap sync')"
              >
                <ILucideCopy class="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div class="bg-blue-50 text-blue-800 text-xs p-3 rounded-md border border-blue-200">
            Tip: Ensure you have initialized Capacitor in your project before running this.
          </div>
        </TabsContent>

        <TabsContent value="upload" class="space-y-4 border rounded-lg p-4 mt-2 bg-background/50">
          <div class="space-y-2">
            <h3 class="font-medium">Login to CLI</h3>
            <div class="bg-black/90 text-white rounded-md p-3 font-mono text-xs text-left">
              <code>npx @capgo/cli login</code>
            </div>
          </div>
          <div class="space-y-2">
            <h3 class="font-medium">Bundle & Upload</h3>
            <div class="bg-black/90 text-white rounded-md p-3 font-mono text-xs text-left">
              <code>npx @capgo/cli upload -a {{ store.currentApp?.name }} -c Production</code>
            </div>
            <p class="text-sm text-muted-foreground">
              This will build your app and upload it to the Production channel.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div class="pt-6 flex justify-between">
        <Button variant="ghost" @click="emit('back')">Back</Button>
        <Button @click="emit('next')">
          Go to Dashboard
          <ILucideArrowRight class="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{
  (e: 'next'): void
  (e: 'back'): void
}>()

const store = useOnboardingStore()

const copy = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('Copied to clipboard')
}
</script>
