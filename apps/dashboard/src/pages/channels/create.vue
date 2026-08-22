<template>
  <div class="space-y-6 max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="router.back()">
        <ILucideArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Create Channel</h1>
        <p class="text-muted-foreground">Add a new deployment channel to your app</p>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Channel Details</CardTitle>
        <CardDescription>
          Channels help you manage different environments or rollout stages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Channel Name</Label>
            <Input
              id="name"
              v-model="formData.name"
              placeholder="e.g. prod, staging, dev"
              required
            />
            <p class="text-xs text-muted-foreground">
              This name is used by the client to identify the channel.
            </p>
          </div>

          <div class="space-y-2">
            <Label>Platform Support</Label>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center space-x-2 border p-3 rounded-lg">
                <Switch id="ios" v-model="formData.ios_enabled" />
                <Label for="ios" class="flex-1 cursor-pointer">iOS Enabled</Label>
              </div>
              <div class="flex items-center space-x-2 border p-3 rounded-lg">
                <Switch id="android" v-model="formData.android_enabled" />
                <Label for="android" class="flex-1 cursor-pointer">Android Enabled</Label>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="environment">Environment</Label>
            <Select v-model="formData.environment" @update:model-value="environmentTouched = true">
              <SelectTrigger>
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prod">Prod</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="dev">Dev</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              The CLI will use the corresponding .env file when deploying to this channel, and the
              server serves this environment's bundles to every device on the channel. The channel
              name does not decide this.
            </p>
            <p v-if="mismatchWarning" class="text-xs text-destructive">
              {{ mismatchWarning }}
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="is_public">Public Channel</Label>
              <Switch id="is_public" v-model="formData.is_public" />
            </div>
            <p class="text-xs text-muted-foreground">
              Public channels allow devices to self-assign if permitted.
            </p>
          </div>

          <div class="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" @click="router.back()"> Cancel </Button>
            <Button type="submit" :disabled="isPending">
              <ILucideLoader2 v-if="isPending" class="mr-2 h-4 w-4 animate-spin" />
              Create Channel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useCreateChannelMutation } from "@/modules/channels/composables/useChannelsQuery";
import { useAppStore } from "@/stores/app.store";
import {
  environmentMismatchWarning,
  suggestEnvironment,
  type EnvironmentSelection,
} from "@capuchoo/core";

definePage({
  meta: {
    title: "Create Channel - Capuchoo",
    category: "channels",
  },
});

const router = useRouter();
const appStore = useAppStore();
const { mutateAsync: createChannel, isPending } = useCreateChannelMutation();

// No default environment. This used to be `"staging" as const`, so creating a
// channel named "prod" without opening the dropdown produced a prod channel
// serving staging bundles.
const formData = ref({
  name: "",
  environment: "" as EnvironmentSelection,
  ios_enabled: true,
  android_enabled: true,
  is_public: false,
});

// Fill the environment in from the name until the user picks one themselves, so
// the common case needs no thought and the deliberate case still wins. The flag
// is set from the Select's own event, not a watcher on the value - a watcher
// would also fire on the autofill below and immediately disable it.
const environmentTouched = ref(false);

watch(
  () => formData.value.name,
  (name) => {
    if (environmentTouched.value) return;
    formData.value.environment = suggestEnvironment(name) ?? "";
  },
);

const mismatchWarning = computed(() =>
  environmentMismatchWarning(formData.value.name, formData.value.environment),
);

const handleSubmit = async () => {
  if (!appStore.activeApp?.app_id) {
    toast.error("No active app selected");
    return;
  }

  // A Select is not an <input>, so `required` on the form does not cover it.
  const environment = formData.value.environment;
  if (!environment) {
    toast.error("Choose an environment for this channel");
    return;
  }

  try {
    const res = await createChannel({
      ...formData.value,
      environment,
      app_id: appStore.activeApp.app_id,
    });
    toast.success("Channel created successfully");
    router.push(`/channels/${res.id}`);
  } catch (error: any) {
    toast.error(error.message || "Failed to create channel");
  }
};
</script>
