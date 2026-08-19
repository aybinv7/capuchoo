<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'

interface DataTableViewOptionsProps {
  table: Table<any>
}

const props = defineProps<DataTableViewOptionsProps>()

const columns = computed(() =>
  props.table.getAllColumns().filter((column) => column.id !== undefined && column.getCanHide()),
)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="h-8">
        <ILucideSettings2 class="mr-2 h-4 w-4" />
        View
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[180px]">
      <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div class="max-h-[400px] overflow-y-auto">
        <DropdownMenuCheckboxItem
          v-for="column in columns"
          :key="column.id"
          class="capitalize"
          :model-value="column.getIsVisible()"
          @update:model-value="(val: boolean) => column.toggleVisibility(val)"
        >
          {{ column.id }}
        </DropdownMenuCheckboxItem>
      </div>

      <DropdownMenuSeparator />

      <DropdownMenuItem class="justify-center text-center" @click="table.resetColumnVisibility()">
        Reset
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
