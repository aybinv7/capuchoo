<template>
  <F7Page name="home" ptr @ptr:refresh="handleRefresh">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      :sliding="false"
    >
      <F7NavLeft>
        <NavbarSwitcher />
      </F7NavLeft>
      <F7NavRight>
        <F7Link class="p-2" @click="toggleNotifications">
          <ILucideBell :size="24" />
        </F7Link>
      </F7NavRight>
      <F7NavTitleLarge>Home</F7NavTitleLarge>
    </F7Navbar>

    <template v-if="activeApp">
      <!-- App Profile Header -->
      <F7Block
        strong
        outline
        class="no-margin-top rounded-b-4xl shadow-sm py-8 border-none bg-linear-to-b"
      >
        <div class="flex items-center gap-5">
          <div class="relative">
            <div
              class="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-black/5 dark:border-white/5 overflow-hidden"
            >
              <img
                :src="activeApp.icon_url || '/icons/icon.png'"
                class="w-full h-full object-cover"
              />
            </div>
            <div
              class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 shadow-sm"
            ></div>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-black no-margin tracking-tight">
                {{ activeApp.name }}
              </h2>
              <F7Badge color="blue" class="uppercase text-[9px] font-black px-1.5 h-4">{{
                activeApp.platform
              }}</F7Badge>
            </div>
            <p class="text-xs text-gray-400 font-mono mt-0.5 opacity-70 break-all max-w-[200px]">
              {{ activeApp.app_id }}
            </p>
          </div>
        </div>
      </F7Block>

      <!-- Statistics Dashboard -->
      <F7BlockTitle class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Performance Insights</F7BlockTitle
      >

      <F7Block class="no-margin-top">
        <div class="row">
          <!-- Total Devices Gauge -->
          <div class="col-50">
            <F7Card
              :outline="true"
              class="no-margin rounded-2xl overflow-hidden border-none shadow-sm h-full pt-4"
            >
              <div class="flex flex-col items-center justify-center p-4">
                <F7Gauge
                  type="semicircle"
                  :value="Math.min((activeApp.total_devices || 0) / 1000, 1)"
                  :value-text="String(activeApp.total_devices || 0)"
                  value-text-color="#2196f3"
                  border-color="#2196f3"
                  :label-text="'Registered'"
                  label-text-color="#8e8e93"
                  :label-font-size="10"
                  :value-font-size="28"
                  :value-font-weight="900"
                />
                <span class="text-[10px] uppercase font-black opacity-30 mt-2 tracking-tighter"
                  >Total Devices</span
                >
              </div>
            </F7Card>
          </div>

          <!-- Adoption Rate / Active Bundles -->
          <div class="col-50">
            <F7Card
              :outline="true"
              class="no-margin rounded-2xl overflow-hidden border-none shadow-sm h-full pt-4"
            >
              <div class="flex flex-col items-center justify-center p-4">
                <F7Gauge
                  type="semicircle"
                  :value="Math.min((activeApp.total_bundles || 0) / 50, 1)"
                  :value-text="String(activeApp.total_bundles || 0)"
                  value-text-color="#ff9800"
                  border-color="#ff9800"
                  label-text="Versions"
                  label-text-color="#8e8e93"
                  :label-font-size="10"
                  :value-font-size="28"
                  :value-font-weight="900"
                />
                <span class="text-[10px] uppercase font-black opacity-30 mt-2 tracking-tighter"
                  >Release History</span
                >
              </div>
            </F7Card>
          </div>
        </div>

        <!-- Distribution Chart -->
        <F7Card
          :outline="true"
          class="mt-4 mx-0! rounded-2xl overflow-hidden border-none shadow-sm p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="no-margin text-lg font-black tracking-tight">System Distribution</h3>
              <p class="no-margin text-xs text-gray-400">Device health and versions</p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center"
            >
              <ILucideActivity :size="20" class="text-blue-500" />
            </div>
          </div>

          <div class="flex items-center justify-around gap-4 py-4">
            <F7PieChart
              tooltip
              :datasets="[
                { label: 'Updated', value: 85, color: '#4caf50' },
                { label: 'Outdated', value: 10, color: '#ff9800' },
                { label: 'Critical', value: 5, color: '#f44336' },
              ]"
              :size="140"
            />
            <div class="flex flex-col gap-3">
              <div
                v-for="tag in [
                  { l: 'Healthy', c: 'bg-green-500', v: '85%' },
                  { l: 'Legacy', c: 'bg-orange-500', v: '10%' },
                  { l: 'Critical', c: 'bg-red-500', v: '5%' },
                ]"
                :key="tag.l"
                class="flex items-center gap-2"
              >
                <div :class="['w-2 h-2 rounded-full', tag.c]"></div>
                <div class="flex flex-col">
                  <span class="text-[10px] font-black uppercase opacity-30 leading-none">{{
                    tag.l
                  }}</span>
                  <span class="text-xs font-bold leading-none mt-1">{{ tag.v }}</span>
                </div>
              </div>
            </div>
          </div>
        </F7Card>
      </F7Block>

      <!-- Action Quick Access -->
      <F7BlockTitle class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Quick Actions</F7BlockTitle
      >
      <F7Block class="no-margin-top grid grid-cols-2 gap-4">
        <F7Button
          large
          fill
          round
          color="blue"
          @click="changeTab('updates')"
          class="font-bold shadow-lg shadow-blue-500/20"
        >
          <ILucideRefreshCw :size="18" class="mr-2" />
          Deploy Update
        </F7Button>
        <F7Button
          large
          fill
          round
          color="orange"
          @click="changeTab('channels')"
          class="font-bold shadow-lg shadow-orange-500/20"
        >
          <ILucideSettings2 :size="18" class="mr-2" />
          Config Channels
        </F7Button>
      </F7Block>
    </template>

    <F7Block
      v-else
      strong
      class="rounded-[2.5rem] mt-12 mx-6 text-center py-16 shadow-2xl border-none bg-white dark:bg-gray-900 flex flex-col items-center justify-center"
    >
      <div
        class="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-8 relative"
      >
        <F7Icon f7="app_badge" size="48" class="opacity-20 animate-pulse text-blue-500" />
        <div
          class="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"
        ></div>
      </div>
      <h2 class="text-2xl font-black no-margin tracking-tight">Ready to start?</h2>
      <p class="text-gray-400 text-sm mt-3 leading-relaxed max-w-[240px]">
        Select an active project context to view your application metrics.
      </p>
      <F7Button
        fill
        round
        large
        @click="openSwitcherInHome"
        class="mt-10 px-12 font-black shadow-xl shadow-blue-500/30"
      >
        Choose Context
      </F7Button>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import NavbarSwitcher from "@/shared/components/app/NavbarSwitcher.vue";
import { useAppStore } from "@/shared/stores/app.store";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";
const isNavbarCollapsed = ref(false);

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const openSwitcherInHome = (e: any) => {
  f7.popover.open(".switcher-popover", e.currentTarget);
};

const handleRefresh = async (done: () => void) => {
  // In Home view, we might want to refetch the active app details or just general dashboard data
  // For now, let's just wait a bit to show the pulse, as activeApp is reactive from the store
  await new Promise((resolve) => setTimeout(resolve, 1000));
  done();
};

const toggleNotifications = () => {
  f7.toast
    .create({
      text: "Notifications coming soon in a future update.",
      closeTimeout: 3000,
    })
    .open();
};

const changeTab = (tab: string) => {
  f7.tab.show(`#view-${tab}`);
};
</script>

<style lang="less" scoped>
.row {
  display: flex;
  margin-left: -8px;
  margin-right: -8px;
  & > div {
    padding-left: 8px;
    padding-right: 8px;
  }
}
</style>
