<script setup lang="ts">
import type { ChartConfig } from '@/components/ui/chart'
import { Donut } from '@unovis/ts'
import { VisDonut, VisSingleContainer } from '@unovis/vue'
import { Radio, TrendingUp } from 'lucide-vue-next'
import { computed } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from '@/components/ui/chart'

// Define types
type DataPoint = {
  channel: string
  count: number
  fill: string
}

// Props interface
interface ChannelDistributionChartProps {
  title?: string
  description?: string
  data: DataPoint[]
}

// Default props
const props = withDefaults(defineProps<ChannelDistributionChartProps>(), {
  title: 'Channel Distribution',
  description: 'Distribution across channels',
  data: () => [],
})

// Chart configuration
const chartConfig = {
  count: {
    label: 'Count',
    color: undefined,
  },
  prod: {
    label: 'Prod',
    color: 'var(--color-chart-1)',
  },
  staging: {
    label: 'Staging',
    color: 'var(--color-chart-2)',
  },
  dev: {
    label: 'Dev',
    color: 'var(--color-chart-3)',
  },
} satisfies ChartConfig

// Calculate total count
const totalCount = computed(() => props.data.reduce((sum, item) => sum + item.count, 0))
</script>

<template>
  <Card class="flex flex-col">
    <CardHeader class="items-center pb-0">
      <CardTitle class="flex items-center gap-2">
        <Radio class="h-5 w-5" />
        {{ title }}
      </CardTitle>
      <CardDescription>{{ description }}</CardDescription>
    </CardHeader>
    <CardContent class="flex-1 pb-0">
      <ChartContainer
        :config="chartConfig"
        class="mx-auto aspect-square max-h-[250px]"
        :style="{
          '--vis-donut-central-label-font-size': 'var(--text-3xl)',
          '--vis-donut-central-label-font-weight': 'var(--font-weight-bold)',
          '--vis-donut-central-label-text-color': 'var(--foreground)',
          '--vis-donut-central-sub-label-text-color': 'var(--muted-foreground)',
        }"
      >
        <VisSingleContainer :data="data" :margin="{ top: 30, bottom: 30 }">
          <VisDonut
            :value="(d: DataPoint) => d.count"
            :color="(d: DataPoint) => chartConfig[d.channel as keyof typeof chartConfig].color"
            :arc-width="30"
            :central-label-offset-y="10"
            :central-label="totalCount.toLocaleString()"
            central-sub-label="Total"
          />
          <ChartTooltip
            :triggers="{
              [Donut.selectors.segment]: componentToString(chartConfig, ChartTooltipContent)!,
            }"
          />
        </VisSingleContainer>
      </ChartContainer>
    </CardContent>
    <CardFooter class="flex-col gap-2 text-sm">
      <div class="flex items-center gap-2 font-medium leading-none">
        Channel distribution overview <TrendingUp class="h-4 w-4" />
      </div>
      <div class="leading-none text-muted-foreground">Showing distribution across all channels</div>
    </CardFooter>
  </Card>
</template>
