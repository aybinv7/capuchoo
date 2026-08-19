<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Bulk Edit</DialogTitle>
        <DialogDescription>
          Edit properties for {{ selectedItems.length }} selected items
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="channel" class="text-right">Channel</Label>
          <Select v-model="bulkEditData.channel" class="col-span-3">
            <SelectTrigger id="channel">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="prod">Prod</SelectItem>
              <SelectItem value="dev">Dev</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="required" class="text-right">Required</Label>
          <Select v-model="bulkEditData.required" class="col-span-3">
            <SelectTrigger id="required">
              <SelectValue placeholder="Select required status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="active" class="text-right">Active</Label>
          <Select v-model="bulkEditData.active" class="col-span-3">
            <SelectTrigger id="active">
              <SelectValue placeholder="Select active status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" @click="$emit('click:bulk-edit-confirm')">Save changes</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { UpdateOrBundle, BulkEditData } from '../../types/updates-bundles.types'

interface Props {
  bulkEditDialogOpen: boolean
  bulkEditData: BulkEditData
  selectedItems: UpdateOrBundle[]
}

interface Emits {
  (e: 'update:bulkEditDialogOpen', value: boolean): void
  (e: 'update:bulkEditData', value: BulkEditData): void
  (e: 'click:bulk-edit-confirm'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogOpen = computed({
  get: () => props.bulkEditDialogOpen,
  set: (value) => emit('update:bulkEditDialogOpen', value),
})

const bulkEditData = computed({
  get: () => props.bulkEditData,
  set: (value) => emit('update:bulkEditData', value),
})
</script>
