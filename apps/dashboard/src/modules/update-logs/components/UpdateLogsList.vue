<script setup lang="ts">
import {
  Download,
  CheckCircle,
  XCircle,
  Activity,
  Globe,
  Clock,
  Smartphone,
  ChevronRight,
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import type { UpdateLog } from '@/modules/update-logs/types/update-logs.types'

defineProps<{
  logs: UpdateLog[]
  hasMore: boolean
  isLoadingMore?: boolean
}>()

defineEmits<{
  (e: 'loadMore'): void
  (e: 'selectLog', log: UpdateLog): void
}>()

// Action config for styling
const actionConfig: Record<
  string,
  {
    icon: any
    bg: string
    text: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  download: { icon: Download, bg: 'bg-blue-500/10', text: 'text-blue-500', variant: 'secondary' },
  install: { icon: CheckCircle, bg: 'bg-green-500/10', text: 'text-green-500', variant: 'default' },
  download_fail: {
    icon: XCircle,
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    variant: 'destructive',
  },
  install_fail: {
    icon: XCircle,
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    variant: 'destructive',
  },
  get: { icon: Activity, bg: 'bg-gray-500/10', text: 'text-gray-500', variant: 'outline' },
  set: { icon: CheckCircle, bg: 'bg-purple-500/10', text: 'text-purple-500', variant: 'secondary' },
  first_open: {
    icon: Activity,
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    variant: 'secondary',
  },
}

// Format helpers
const formatAction = (action: string) =>
  action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const formatDateTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const getActionConfig = (action: string) => {
  const config = actionConfig[action]
  if (config) return config
  // Fallback config
  return {
    icon: Activity,
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    variant: 'outline' as const,
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Log entries -->
    <div
      v-for="log in logs"
      :key="log.id"
      class="group flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer"
      @click="$emit('selectLog', log)"
    >
      <!-- Status Icon -->
      <div
        :class="
          cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
            getActionConfig(log.action).bg,
          )
        "
      >
        <component
          :is="getActionConfig(log.action).icon"
          :class="cn('h-5 w-5', getActionConfig(log.action).text)"
        />
      </div>

      <!-- Main Content -->
      <div class="flex-1 min-w-0 space-y-1">
        <!-- Header Row -->
        <div class="flex items-center gap-2 flex-wrap">
          <Badge :variant="getActionConfig(log.action).variant">
            {{ formatAction(log.action) }}
          </Badge>
          <Badge variant="outline" class="gap-1">
            <Smartphone class="h-3 w-3" />
            {{ log.platform }}
          </Badge>
          <span class="text-sm text-muted-foreground">
            {{ formatRelativeTime(log.timestamp) }}
          </span>
        </div>

        <!-- Device & Version Info -->
        <p class="text-sm">
          <code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{{ log.device_id }}</code>
          <template v-if="log.new_version">
            <span class="mx-1">→</span>
            <strong class="text-green-600 dark:text-green-400">v{{ log.new_version }}</strong>
          </template>
          <template v-if="log.current_version">
            <span class="text-muted-foreground ml-1">(from v{{ log.current_version }})</span>
          </template>
        </p>

        <!-- Meta Info -->
        <div class="flex items-center gap-4 text-xs text-muted-foreground">
          <div v-if="log.ip" class="flex items-center gap-1">
            <Globe class="h-3 w-3" />
            {{ log.ip }}
          </div>
          <div class="flex items-center gap-1">
            <Clock class="h-3 w-3" />
            {{ formatDateTime(log.timestamp) }}
          </div>
        </div>
      </div>

      <!-- Chevron -->
      <ChevronRight
        class="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="flex justify-center pt-4">
      <Button variant="outline" @click="$emit('loadMore')" :disabled="isLoadingMore">
        <template v-if="isLoadingMore">
          <span class="animate-spin mr-2">⏳</span>
          Loading...
        </template>
        <template v-else> Load more logs </template>
      </Button>
    </div>
  </div>
</template>
