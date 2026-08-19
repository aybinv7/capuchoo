<template>
  <div class="space-y-4">
    <DevicesTableBulkEdit
      :selected-items="selectedItems"
      @click:bulk-delete="handleBulkDelete"
      @click:bulk-edit="handleBulkEdit"
      @click:bulk-export="handleBulkExport"
      @click:clear-selection="clearSelection"
    />

    <DevicesTableDataTable
      ref="dataTableRef"
      :columns="devicesColumns"
      :data="items"
      :is-loading="isLoading"
      @selection-change="handleSelectionChange"
      @row-click="handleRowClick"
      @refresh="$emit('refresh')"
    />

    <DevicesDeleteDialog
      v-model:delete-dialog-open="deleteDialogOpen"
      :is-deleting="isDeleting"
      :item-to-delete="itemToDelete"
      :selected-items="selectedItems"
      @click:handle-delete-confirm="handleDeleteConfirm"
    />

    <!-- We can add BulkEditDialog here if/when needed, similar to UpdatesBundles -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { devicesColumns } from './DevicesTable/devices.columns'
import type { Device } from '@/modules/devices/types/devices.types'
import DevicesTableDataTable from './DevicesTable/DevicesTableDataTable.vue'
import DevicesTableBulkEdit from './DevicesTable/DevicesTableBulkEdit.vue'
import DevicesDeleteDialog from './DevicesTable/DevicesDeleteDialog.vue'

const dataTableRef = ref()
const selectedItems = ref<Device[]>([])
const deleteDialogOpen = ref(false)
const itemToDelete = ref<string | null>(null)
const isDeleting = ref(false)

const { items, isLoading } = defineProps<{
  items: Device[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'deleteItem', id: string): void
  (e: 'refresh'): void
}>()

const handleSelectionChange = (selection: Device[]) => {
  selectedItems.value = selection
}

import { useRouter } from 'vue-router'

const router = useRouter()

const handleRowClick = (item: Device) => {
  router.push(`/devices/${item.id}`)
}

const handleBulkEdit = () => {
  console.log('Bulk edit requested')
}

const handleBulkExport = () => {
  console.log('Bulk export requested')
}

const handleBulkDelete = () => {
  itemToDelete.value = null
  deleteDialogOpen.value = true
}

const handleDeleteConfirm = async () => {
  isDeleting.value = true
  try {
    if (itemToDelete.value) {
      emit('deleteItem', itemToDelete.value)
    } else {
      selectedItems.value.forEach((item) => {
        emit('deleteItem', item.device_id)
      })
    }
    clearSelection()
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

defineExpose({
  clearSelection,
})
</script>
