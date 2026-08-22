```
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "vue-sonner";

const emit = defineEmits<{
  (e: "next"): void;
  (e: "back"): void;
}>();

const onboardingStore = useOnboardingStore();
// Use store loading state
const isLoading = computed(() => onboardingStore.loading);

const form = ref({
  appName: onboardingStore.appData.name || "",
  appId: onboardingStore.appData.appId || "",
  platform: "capacitor",
});

// Suggests a bundle identifier from the name, but only until the field is
// touched: this is the app's identity everywhere else - devices send it on every
// update check - so a guess must never be submitted silently.
const appIdTouched = ref(false);

watch(
  () => form.value.appName,
  (name) => {
    if (appIdTouched.value) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 30);
    form.value.appId = slug ? `com.example.${slug}` : "";
  },
);

const BUNDLE_ID = /^[a-z][a-z\d_]*(\.[a-z][a-z\d_]*)+$/;
const appIdError = computed(() => {
  if (!form.value.appId) return "";
  return BUNDLE_ID.test(form.value.appId)
    ? ""
    : "Lower case, at least two dot-separated segments, no hyphens - e.g. com.company.app";
});

async function handleCreateApp() {
  if (!form.value.appName) {
    toast.error("Please enter an app name");
    return;
  }

  if (!form.value.appId || appIdError.value) {
    toast.error("Enter the app's bundle identifier, e.g. com.company.app");
    return;
  }

  onboardingStore.setAppDraft(form.value.appName, form.value.appId, form.value.platform);

  try {
    // Trigger the final submission
    await onboardingStore.submitOnboarding();
    toast.success("Onboarding completed successfully!");
    emit("next");
  } catch (error: any) {
    console.error("Onboarding submission error:", error);
    toast.error(error.message || "Failed to complete onboarding");
  }
}
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle>Create App</CardTitle>
      <CardDescription> Create your first application. </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="appName">App Name</Label>
          <Input id="appName" v-model="form.appName" placeholder="My App" />
        </div>

        <div class="grid gap-2">
          <Label for="appId">Bundle identifier</Label>
          <Input
            id="appId"
            v-model="form.appId"
            placeholder="com.company.app"
            @input="appIdTouched = true"
          />
          <p v-if="appIdError" class="text-xs text-destructive">{{ appIdError }}</p>
          <p v-else class="text-xs text-muted-foreground">
            Must match the identifier in your Capacitor project - devices send it on every update
            check, and the CLI resolves your app by it.
          </p>
        </div>

        <div class="grid gap-2">
          <Label>Platform</Label>
          <Select v-model="form.platform">
            <SelectTrigger>
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="capacitor">Capacitor</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="android">Android</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            Used to show relevant integration instructions.
          </p>
        </div>
      </div>
    </CardContent>
    <CardFooter class="flex justify-between">
      <Button variant="ghost" :disabled="isLoading" @click="emit('back')"> Back </Button>
      <Button :disabled="isLoading" @click="handleCreateApp">
        <span v-if="isLoading">Creating...</span>
        <span v-else>Continue</span>
      </Button>
    </CardFooter>
  </Card>
</template>
