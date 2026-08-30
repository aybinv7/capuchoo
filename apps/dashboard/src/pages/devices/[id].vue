<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold tracking-tight font-mono text-primary">
            {{ device?.device_id }}
          </h1>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground text-sm">
          <IStreamlineLogosAndroidLogoBlock v-if="device?.platform === 'android'" class="w-4 h-4" />
          <IStreamlineLogosAppleLogoBlock v-if="device?.platform === 'ios'" class="w-4 h-4" />
          <span class="capitalize">{{ device?.platform }}</span>
          <span>•</span>
          <span>Last seen {{ formatDate(device?.last_check, true) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!--
          "Sync" was here, with no handler and no endpoint behind it. There
          cannot be one: a device polls us, we have no channel to push down, so
          a button promising to reach it would be a lie however it was wired.
          "Refresh" is what this page can actually do - re-read what the server
          knows.
        -->
        <Button variant="outline" size="sm" :disabled="refreshing" @click="refresh">
          <ILucideRefreshCcw class="mr-2 h-4 w-4" :class="refreshing && 'animate-spin'" />
          Refresh
        </Button>
        <Button variant="destructive" size="sm" @click="deleteDialogOpen = true">
          <ILucideTrash2 class="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Channel</CardTitle>
          <Radio class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold capitalize">{{ device?.channel || "Production" }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Current Version</CardTitle>
          <GitCommit class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <!-- `current_bundle_id` and `current_native_id` were read here and exist
             on no table and in no API response, so both cards read N/A forever.
             The device row records the applied bundle as `version_name` and the
             native build number as `version_build`. -->
        <CardContent>
          <div class="text-2xl font-bold">{{ device?.version_name || "builtin" }}</div>
          <p class="text-xs text-muted-foreground">
            {{
              device?.version_builtin
                ? `Shipped with ${device.version_builtin}`
                : "Applied OTA bundle"
            }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Native Build</CardTitle>
          <Smartphone class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ device?.version_build || "N/A" }}</div>
          <p class="text-xs text-muted-foreground">versionCode of the installed binary</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">OS</CardTitle>
          <Cpu class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <!-- This card said "Model / Unknown", hardcoded. Nothing stores a device
             model: the runtime reports OS version, emulator and plugin version,
             and those are what is shown. Adding a model means a field on the
             contract, the runtime, the devices table and a migration. -->
        <CardContent>
          <div class="text-2xl font-bold">
            {{ device?.version_os || "Unknown" }}

            <Dialog v-model:open="deleteDialogOpen">
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Forget this device?</DialogTitle>
                  <DialogDescription>
                    This removes what we know about it. The device itself is untouched - if the app
                    is still installed it will reappear on its next update check, under the same id.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="deleteDialogOpen = false">Cancel</Button>
                  <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
                    {{ deleting ? "Deleting..." : "Delete" }}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p class="text-xs text-muted-foreground">
            <template v-if="device?.is_emulator">Emulator · </template>
            <template v-if="device?.plugin_version">plugin {{ device.plugin_version }}</template>
            <template v-else>{{ device?.platform }}</template>
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Update History</CardTitle>
            <CardDescription>Events this device reported, most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="relative pl-6 border-l-2 border-muted space-y-8">
              <div v-if="historyLoading" class="text-sm text-muted-foreground">Loading…</div>

              <div v-else-if="!history?.length" class="text-sm text-muted-foreground">
                Nothing reported yet. Events appear here as the device checks for, downloads and
                applies updates.
              </div>

              <div v-for="event in history ?? []" :key="event.id" class="relative">
                <div
                  :class="[
                    'absolute -left-[29px] top-1 h-3 w-3 rounded-full border-4 border-background',
                    isFailure(event.action) ? 'bg-destructive' : 'bg-primary',
                  ]"
                />
                <div class="space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium">{{ describeAction(event.action) }}</span>
                    <Badge v-if="event.new_version" variant="outline" class="text-xs">
                      v{{ event.new_version }}
                    </Badge>
                    <Badge
                      v-if="event.current_version && event.current_version !== event.new_version"
                      variant="secondary"
                      class="text-xs"
                    >
                      from v{{ event.current_version }}
                    </Badge>
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {{ formatDate(event.created_at, true) }}
                  </div>
                  <p v-if="event.error_message" class="text-sm text-destructive break-words">
                    {{ event.error_message }}
                  </p>
                </div>
              </div>

              <!-- Initial Install -->
              <div class="relative">
                <div
                  class="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-muted border-4 border-background"
                />
                <div class="space-y-1">
                  <div class="font-medium">Device Registered</div>
                  <div class="text-sm text-muted-foreground">
                    {{ formatDate(device?.created_at, true) }}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- JSON Dump -->
        <Card>
          <CardHeader>
            <CardTitle>Raw Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto">
              <pre>{{ JSON.stringify(device, null, 2) }}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Mini Map -->
        <Card class="overflow-hidden border-border/50">
          <CardTitle class="text-sm font-medium">Location</CardTitle>
          <CardContent class="p-0">
            <div class="h-[300px] relative">
              <DevicesMap
                v-if="device"
                :items="[device]"
                :show-controls="false"
                class="h-full w-full rounded-none"
              />
            </div>
          </CardContent>
        </Card>

        <!-- This was a hardcoded green pulse reading "Healthy - communicating
             regularly", shown whether the device had checked in a minute ago or
             never. It now reflects last_check, which is the only thing this page
             can actually observe. -->
        <Card>
          <CardContent>
            <div class="flex items-center gap-2">
              <ILucideActivity
                :class="[
                  'h-5 w-5',
                  health.tone === 'ok' && 'animate-pulse text-green-600',
                  health.tone === 'warn' && 'text-amber-500',
                  health.tone === 'muted' && 'text-muted-foreground',
                ]"
              />
              <span class="font-medium">{{ health.label }}</span>
            </div>
            <p class="text-xs mt-2 text-muted-foreground">{{ health.detail }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Explicit: `toast` is not in auto-imports.d.ts, unlike almost everything else
// this file uses. Relying on the auto-import here is how `router.push` shipped
// against an unbound `router` on the bundle page.
import { toast } from "vue-sonner";

const { id: deviceId } = defineProps<{
  id: string;
}>();

const { data: devices, refetch } = useDevicesQuery();

const device = computed(() => devices.value?.find((d) => String(d.id) === deviceId));

const router = useRouter();
const refreshing = ref(false);
const deleting = ref(false);
const deleteDialogOpen = ref(false);

const { mutateAsync: deleteDevice } = useDeleteDeviceMutation();

async function refresh(): Promise<void> {
  refreshing.value = true;
  try {
    await refetch();
  } finally {
    refreshing.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (!device.value) return;

  deleting.value = true;
  try {
    await deleteDevice(device.value.id);
    toast.success("Device forgotten");
    deleteDialogOpen.value = false;
    await router.push("/devices");
  } catch {
    toast.error("Could not delete this device");
  } finally {
    deleting.value = false;
  }
}

/**
 * The device's real event history.
 *
 * This card used to render two invented rows - "Updated to v1.2.0 Bundled, 2
 * hours ago" and "v1.1.0 Native, Yesterday" - under a comment saying history
 * was not stored yet. It is: `update_logs.device_id` is a foreign key into
 * `devices(id)` and the endpoint has always accepted a `device_id` filter. So
 * the page was showing fiction next to a real "Device Registered" row, which
 * is the worst possible combination - it looked like data.
 */
const { data: history, isLoading: historyLoading } = useUpdateLogsQuery({
  deviceId: computed(() => device.value?.id),
  limit: 25,
});

/** `update_logs.action`, as something worth reading on a timeline. */
const ACTION_LABELS: Record<string, string> = {
  get: "Checked for updates",
  update_available: "Update offered",
  no_update_available: "Already up to date",
  download: "Download started",
  download_complete: "Download finished",
  download_failed: "Download failed",
  install: "Install started",
  set: "Bundle applied",
  app_ready: "Booted successfully",
  update_failed: "Update failed",
  native_update_required: "Native update required",
  blocked_by_server_url: "Blocked by server",
};

const describeAction = (action: string) =>
  ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const isFailure = (action: string) => action.includes("fail") || action === "blocked_by_server_url";

/**
 * Healthy means "checked in recently", which is the only thing this page can
 * actually observe. It used to be a hardcoded green pulse that said the device
 * was communicating regularly whether or not it had been seen for a year.
 */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const health = computed(() => {
  const seen = device.value?.last_check;
  if (!seen)
    return { label: "Never seen", tone: "muted", detail: "This device has never checked in." };

  const age = Date.now() - new Date(seen).getTime();
  if (Number.isNaN(age)) {
    return { label: "Unknown", tone: "muted", detail: "The last check-in time could not be read." };
  }

  return age < STALE_AFTER_MS
    ? { label: "Healthy", tone: "ok", detail: "Checked in within the last seven days." }
    : {
        label: "Stale",
        tone: "warn",
        detail: `Last checked in ${Math.floor(age / 86_400_000)} days ago.`,
      };
});

const formatDate = (dateString?: string, time = false) => {
  if (!dateString) return "Unknown date";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  if (time) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return new Date(dateString).toLocaleDateString(undefined, opts);
};

definePage({
  meta: {
    title: "Device Details - Capuchoo",
    category: "devices",
  },
  props: true,
});
</script>
