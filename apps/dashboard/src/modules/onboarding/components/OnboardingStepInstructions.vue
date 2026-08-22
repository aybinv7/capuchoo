<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight">Integration Guide</h1>
      <p class="text-muted-foreground">
        Three steps to put updates in front of
        <span class="font-medium">{{ appName }}</span>
        's users.
      </p>
    </div>

    <div class="w-full">
      <Tabs default-value="install" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="install">1. Install</TabsTrigger>
          <TabsTrigger value="wire">2. Wire it up</TabsTrigger>
          <TabsTrigger value="deploy">3. Deploy</TabsTrigger>
        </TabsList>

        <TabsContent value="install" class="space-y-4 border rounded-lg p-4 mt-2 bg-background/50">
          <div class="space-y-2">
            <h3 class="font-medium">Add the runtime and the CLI</h3>
            <CodeBlock :code="installCommand" @copy="copy" />
            <p class="text-xs text-muted-foreground">
              <code>@capgo/capacitor-updater</code> is the native plugin Capuchoo drives.
              <code>@capacitor/device</code> is optional - it lets the app report its OS version and
              whether it is an emulator.
            </p>
          </div>
          <div class="space-y-2">
            <h3 class="font-medium">Sync the native projects</h3>
            <CodeBlock code="npx cap sync" @copy="copy" />
          </div>
        </TabsContent>

        <TabsContent value="wire" class="space-y-4 border rounded-lg p-4 mt-2 bg-background/50">
          <div class="space-y-2">
            <h3 class="font-medium">Confirm the running bundle booted</h3>
            <CodeBlock :code="notifySnippet" @copy="copy" />
            <p class="text-xs text-muted-foreground">
              First statement in <code>main.ts</code>, before anything that can block. The plugin
              rolls back to the previous bundle if it does not hear this within ten seconds - so a
              late or conditional call reverts updates that installed perfectly.
            </p>
          </div>
          <div class="space-y-2">
            <h3 class="font-medium">Configure the plugin</h3>
            <CodeBlock :code="configSnippet" @copy="copy" />
            <p class="text-xs text-muted-foreground">
              Returns <code>autoUpdate: "onlyDownload"</code>, so your UI decides when to apply, and
              throws on an empty API URL rather than shipping a build that silently never checks.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="deploy" class="space-y-4 border rounded-lg p-4 mt-2 bg-background/50">
          <div class="space-y-2">
            <h3 class="font-medium">Sign in and link this directory</h3>
            <CodeBlock :code="loginCommand" @copy="copy" />
            <p class="text-xs text-muted-foreground">
              <code>init</code> writes <code>.capuchoo/project.json</code>, which records the bundle
              identifier <code>{{ bundleId }}</code> and is safe to commit.
            </p>
          </div>
          <div class="space-y-2">
            <h3 class="font-medium">Publish a web bundle</h3>
            <CodeBlock :code="deployCommand" @copy="copy" />
            <p class="text-sm text-muted-foreground">
              Builds the <span class="font-medium">{{ channelEnvironment }}</span> flavour and
              publishes it to the <span class="font-medium">{{ channelName }}</span> channel. Add
              <code>--dry-run</code> to build and package without uploading.
            </p>
          </div>
          <div class="bg-blue-50 text-blue-800 text-xs p-3 rounded-md border border-blue-200">
            A channel's <strong>environment</strong> - not its name - decides which flavour is built
            and which bundles devices receive.
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
import { computed } from "vue";
import { toast } from "vue-sonner";
import CodeBlock from "./CodeBlock.vue";

const emit = defineEmits<{
  (e: "next"): void;
  (e: "back"): void;
}>();

const store = useOnboardingStore();

const appName = computed(() => store.currentApp?.name ?? store.appData.name ?? "your app");
const bundleId = computed(
  () => store.currentApp?.app_id ?? store.appData.appId ?? "com.company.app",
);

// Name the channel that actually exists. This guide used to tell people to
// publish to "Production", which onboarding never created.
const channelName = computed(() => store.currentChannel?.name ?? "staging");
const channelEnvironment = computed(() => store.currentChannel?.environment ?? "staging");

const installCommand =
  "npm install @capuchoo/updater @capuchoo/core @capgo/capacitor-updater @capacitor/device\n" +
  "npm install --save-dev @capuchoo/cli";

const notifySnippet =
  'import { notifyAppReady } from "@capuchoo/updater";\n\nvoid notifyAppReady();';

const configSnippet =
  '// capacitor.config.ts\nimport { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";\n\n' +
  "plugins: {\n" +
  "  CapacitorUpdater: capuchooUpdaterConfig({\n" +
  "    apiUrl: process.env.VITE_UPDATE_API_URL,\n" +
  "    channel: process.env.VITE_UPDATE_CHANNEL,\n" +
  "  }),\n" +
  "}";

const loginCommand = computed(() => "npx capuchoo auth login\nnpx capuchoo init");
const deployCommand = computed(() => `npx capuchoo deploy ota --channel ${channelName.value}`);

const copy = (text: string) => {
  void navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};
</script>
