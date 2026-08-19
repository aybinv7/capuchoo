<script setup lang="ts">
import type { ChartConfig } from '@/components/ui/chart'

import { VisAxis, VisGroupedBar, VisXYContainer } from '@unovis/vue'
import { TrendingUp } from 'lucide-vue-next'
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
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from '@/components/ui/chart'

const props = defineProps<{
  data?: any[]
  title?: string
  description?: string
}>()

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data.map((item) => ({
    ...item,
    date: new Date(item.date),
  }))
})

type Data = (typeof chartData)['value'][number]

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Bar Chart - Multiple</CardTitle>
      <CardDescription>January - June 2024</CardDescription>
    </CardHeader>
    <CardContent>
      <ChartContainer :config="chartConfig">
        <VisXYContainer :data="chartData">
          <VisGroupedBar
            :x="(d: Data) => d.date"
            :y="[(d: Data) => d.desktop, (d: Data) => d.mobile]"
            :color="[chartConfig.desktop.color, chartConfig.mobile.color]"
            :rounded-corners="4"
            bar-padding="0.15"
            group-padding="0"
          />
          <VisAxis
            type="x"
            :x="(d: Data) => d.date"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :num-ticks="6"
            :tick-format="
              (d: number) => {
                const date = new Date(d)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                })
              }
            "
            :tick-values="chartData.map((d) => d.date)"
          />
          <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
          <ChartTooltip />
          <ChartCrosshair
            :template="
              componentToString(chartConfig, ChartTooltipContent, {
                indicator: 'dashed',
                hideLabel: true,
              })
            "
            color="#0000"
          />
        </VisXYContainer>
      </ChartContainer>
    </CardContent>
    <CardFooter class="flex-col items-start gap-2 text-sm">
      <div class="flex gap-2 font-medium leading-none">
        Trending up by 5.2% this month <TrendingUp class="h-4 w-4" />
      </div>
      <div class="leading-none text-muted-foreground">
        Showing total visitors for the last 6 months
      </div>
    </CardFooter>
  </Card>
</template>
