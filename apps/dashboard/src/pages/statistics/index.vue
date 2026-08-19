<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Statistics</h1>
        <p class="text-muted-foreground">Analytics overview for your apps</p>
      </div>
      <Select v-model="timeRange">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Stats Cards -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card v-for="i in 4" :key="i">
        <CardContent class="px-6 py-3">
          <div class="space-y-2">
            <Skeleton class="h-4 w-[100px]" />
            <Skeleton class="h-8 w-[60px]" />
          </div>
        </CardContent>
      </Card>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card v-for="(stat, index) in statsCards" :key="index">
        <CardContent class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">{{ stat.title }}</p>
              <p class="text-2xl font-bold">{{ stat.value }}</p>
              <p
                v-if="stat.change"
                :class="['text-xs', stat.change > 0 ? 'text-green-600' : 'text-red-600']"
              >
                {{ stat.change > 0 ? '+' : '' }}{{ stat.change }}% from last period
              </p>
            </div>
            <div :class="['p-3 rounded-full', stat.bgColor]">
              <component :is="stat.icon" class="h-6 w-6" :class="stat.textColor" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Charts -->
    <div class="space-y-6">
      <UpdateDownloadsChart
        :data="downloadChartData"
        title="Update Downloads"
        description="Download activity over time"
        class="w-full"
      />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChannelDistributionChart
          :data="channelDistributionData"
          title="Channel Distribution"
          description="Updates per channel"
        />
        <DeviceDistributionChart
          :data="deviceDistributionData"
          title="Platform Distribution"
          description="Devices by platform"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Package, Smartphone, Download, TrendingUp } from 'lucide-vue-next'

definePage({
  meta: {
    title: 'Statistics - CapGO Updater',
    description: 'Analytics and metrics for your apps',
    category: 'statistics',
  },
})

const timeRange = ref('30d')

const { data: statsData, isLoading } = useDashboardStatsQuery()

const statsCards = computed(() => [
  {
    title: 'Total Updates',
    value: statsData.value?.bundles_count ?? 0,
    change: 12,
    icon: Package,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
  },
  {
    title: 'Active Devices',
    value: statsData.value?.devices_count ?? 0,
    change: 8,
    icon: Smartphone,
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
  },
  {
    title: 'Downloads',
    value: statsData.value?.downloads_count ?? 0,
    change: 24,
    icon: Download,
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-600',
  },
  {
    title: 'Success Rate',
    value: '98.5%',
    change: 2.1,
    icon: TrendingUp,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-600',
  },
])

// Chart data - would come from API
const downloadChartData = computed(() => [
  { date: new Date('2024-04-01'), desktop: 222, mobile: 150 },
  { date: new Date('2024-04-02'), desktop: 97, mobile: 180 },
  { date: new Date('2024-04-03'), desktop: 167, mobile: 120 },
  { date: new Date('2024-04-04'), desktop: 242, mobile: 260 },
  { date: new Date('2024-04-05'), desktop: 373, mobile: 290 },
  { date: new Date('2024-04-06'), desktop: 301, mobile: 340 },
  { date: new Date('2024-04-07'), desktop: 245, mobile: 180 },
])

const deviceDistributionData = computed(() => [
  { platform: 'android', downloads: 350 },
  { platform: 'ios', downloads: 280 },
])

const channelDistributionData = computed(() => [
  { channel: 'staging', count: 450, fill: 'var(--color-chart-1)' },
  { channel: 'prod', count: 300, fill: 'var(--color-chart-2)' },
  { channel: 'dev', count: 180, fill: 'var(--color-chart-3)' },
])
</script>
