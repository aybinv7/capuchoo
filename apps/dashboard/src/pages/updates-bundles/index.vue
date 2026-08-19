<template>
  <div class="space-y-6">
    <UpdatesBundlesHeader />

    <UpdatesBundlesTable
      :items="filteredItems"
      :is-loading="isFetching"
      @delete-item="handleDelete"
      @update-item="handleUpdate"
      @refresh="refetch"
    />
  </div>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Updates & Bundles - CapGO Updater',
    description: 'Manage app updates and bundles',
    category: 'updates-bundles',
    hideFromSearch: false,
  },
})

// State
const searchTerm = ref('')
const filterType = ref('all')
const filterChannel = ref('all')
const filterPlatform = ref('all')

// Get data using composables
const { data: items, refetch, isFetching } = useUpdatesBundlesQuery()

const compareSemver = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map((p) => parseInt(p) || 0)
  const parts2 = v2.split('.').map((p) => parseInt(p) || 0)
  const maxLen = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0
    const p2 = parts2[i] ?? 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

const processedItems = computed(() => {
  if (!items.value) return []

  // Helper to get uniqueness key - Group by Platform ONLY to find global latest
  const getKey = (item: any) => item.platform

  // Group items by key (Platform)
  const grouped = new Map<string, any[]>()

  items.value.forEach((item) => {
    const key = getKey(item)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(item)
  })

  const latestIds = new Set<string>()

  // For each platform, find the highest version string
  grouped.forEach((groupItems) => {
    // 1. Find max semver
    const maxVersion = groupItems.reduce((max, current) => {
      // If no max yet, take current
      if (!max) return current.version_name

      // Compare semver
      return compareSemver(current.version_name, max) > 0 ? current.version_name : max
    }, '')

    // 2. Mark ALL items that match this max version as latest
    // This handles cases where Native 1.0.6 and OTA 1.0.6 both exist and are both "latest"
    groupItems.forEach((item) => {
      if (item.version_name === maxVersion) latestIds.add(item.id)
    })
  })

  // Return sorted by date for the list, with computed flags
  const result = [...items.value]
    .map((item) => ({
      ...item,
      // Trust backend for is_active_for, default to empty if missing
      is_active_for: item.is_active_for || [],
      is_latest: latestIds.has(item.id),
      // Ensure we have a valid date object for sorting if needed, though we use string
      created_at_date: new Date(item.created_at),
    }))
    .sort((a, b) => b.created_at_date.getTime() - a.created_at_date.getTime())

  return result
})

// Filter items based on search and filters
const filteredItems = computed(() => {
  return processedItems.value.filter((item) => {
    const matchesSearch =
      item.version_name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      item.channel.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (item.release_notes?.toLowerCase().includes(searchTerm.value.toLowerCase()) ?? false)

    const matchesType = filterType.value === 'all' || item.type === filterType.value
    const matchesChannel = filterChannel.value === 'all' || item.channel === filterChannel.value
    const matchesPlatform = filterPlatform.value === 'all' || item.platform === filterPlatform.value
    return matchesSearch && matchesType && matchesChannel && matchesPlatform
  })
})

const handleDelete = async (id: string, type: 'bundle' | 'native') => {
  // In a real implementation, you would call the appropriate delete mutation
  // For now, we'll just trigger a refetch
  console.log('iddd', id, type)
  await refetch()
}

const handleUpdate = async (item: UpdateOrBundle) => {
  console.log('Update item:', item)
  await refetch()
}
</script>
