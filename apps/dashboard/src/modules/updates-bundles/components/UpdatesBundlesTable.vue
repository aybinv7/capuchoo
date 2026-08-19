<template>
  <div class="space-y-4">
    <UpdatesBundlesTableBulkEdit
      :selected-items="selectedItems"
      @click:bulk-delete="handleBulkDelete"
      @click:bulk-edit="handleBulkEdit"
      @click:bulk-export="handleBulkExport"
      @click:clear-selection="clearSelection"
    />
    <UpdatesBundlesTableDataTable
      ref="dataTableRef"
      :columns="updatesBundlesColumns"
      :data="items"
      :meta="{ triggerPromote }"
      :is-loading="isLoading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
      @refresh="$emit('refresh')"
    />

    <UpdatesBundlesTableDeleteDialog
      v-model:delete-dialog-open="deleteDialogOpen"
      :is-deleting="isDeleting"
      :item-to-delete="itemToDelete"
      :selected-items="selectedItems"
      @click:handle-delete-confirm="handleDeleteConfirm"
    />

    <UpdatesBundlesTableBulkEditDialog
      v-model:bulkEditData="bulkEditData"
      v-model:bulkEditDialogOpen="bulkEditDialogOpen"
      :selected-items="selectedItems"
      @click:bulk-edit-confirm="handleBulkEditConfirm"
    />

    <UpdatesBundlesTablePromoteDialog
      v-model:promote-dialog-open="promoteDialogOpen"
      :item-id="itemToPromote"
      @promoted="handlePromoted"
    />
  </div>
</template>

<script setup lang="ts">
import { updatesBundlesColumns } from './UpdatesBundlesTable/updates-bundles.columns'
import type { UpdateOrBundle } from '../types/updates-bundles.types'

const router = useRouter()
const dataTableRef = ref()
const selectedItems = ref<UpdateOrBundle[]>([])
const deleteDialogOpen = ref(false)
const bulkEditDialogOpen = ref(false)
const itemToDelete = ref<string | null>(null)
const itemToPromote = ref<string | null>(null)
const promoteDialogOpen = ref(false)
const isDeleting = ref(false)

const bulkEditData = ref({
  channel: '',
  required: '',
  active: '',
})

const props = defineProps<{
  items: UpdateOrBundle[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'deleteItem', id: string, type: 'bundle' | 'native'): void
  (e: 'updateItem', item: UpdateOrBundle): void
  (e: 'refresh'): void
}>()

const handleSelectionChange = (selection: UpdateOrBundle[]) => {
  selectedItems.value = selection
}

const handleRowClick = (item: UpdateOrBundle) => {
  // Navigate to the detail page with type query param
  router.push(`/updates-bundles/${item.id}?type=${item.type}`)
}

const handleBulkEdit = () => {
  bulkEditDialogOpen.value = true
  bulkEditData.value = {
    channel: '',
    required: '',
    active: '',
  }
}

const handleBulkEditConfirm = () => {
  console.log('Bulk editing items:', {
    ids: selectedItems.value.map((p) => p.id),
    changes: bulkEditData.value,
  })
  bulkEditDialogOpen.value = false
  clearSelection()
}

const handleBulkExport = () => {
  console.log(
    'Exporting items:',
    selectedItems.value.map((p) => p.id),
  )
  const csv = selectedItems.value
    .map(
      (p) =>
        `${p.id},${p.type},${p.version_name},${p.platform},${p.channel},${p.required},${p.active}`,
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'updates-bundles.csv'
  a.click()
}

const handleBulkDelete = () => {
  itemToDelete.value = null
  deleteDialogOpen.value = true
}

const handleDeleteConfirm = async () => {
  isDeleting.value = true

  try {
    if (itemToDelete.value) {
      // Single item delete
      const item = props.items.find((i) => i.id === itemToDelete.value)
      if (item) {
        emit('deleteItem', item.id, item.type)
      }
    } else {
      // Bulk delete
      selectedItems.value.forEach((item) => {
        emit('deleteItem', item.id, item.type)
      })
    }

    clearSelection()
  } catch (error) {
    console.error('Delete error:', error)
  } finally {
    isDeleting.value = false
    deleteDialogOpen.value = false
    itemToDelete.value = null
  }
}

const clearSelection = () => {
  if (dataTableRef.value) {
    dataTableRef.value.clearSelection()
  }
  selectedItems.value = []
}

const handlePromoted = () => {
  clearSelection()
  emit('updateItem', {} as any)
}

const triggerDelete = (itemId: string) => {
  itemToDelete.value = itemId
  deleteDialogOpen.value = true
}

const triggerPromote = (itemId: string) => {
  itemToPromote.value = itemId
  promoteDialogOpen.value = true
}

defineExpose({
  triggerDelete,
  triggerPromote,
  clearSelection,
})
</script>
