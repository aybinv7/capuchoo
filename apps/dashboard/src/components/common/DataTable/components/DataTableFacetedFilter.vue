<template>
  <DropdownMenu v-if="column">
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="h-8 border-dashed">
        <PlusCircle class="mr-2 h-4 w-4" />
        {{ title }}
        <Badge
          v-if="selectedValues.size > 0"
          variant="secondary"
          class="ml-2 rounded-sm px-1 font-normal lg:hidden"
        >
          {{ selectedValues.size }}
        </Badge>
        <div v-if="selectedValues.size > 0" class="hidden space-x-1 lg:flex">
          <Badge
            v-if="selectedValues.size > 2"
            variant="secondary"
            class="rounded-sm px-1 font-normal"
          >
            {{ selectedValues.size }} selected
          </Badge>
          <template v-else>
            <Badge
              v-for="value in Array.from(selectedValues).slice(0, 2)"
              :key="String(value)"
              variant="secondary"
              class="rounded-sm px-1 font-normal"
            >
              {{ options.find((opt) => opt.value === value)?.label }}
            </Badge>
          </template>
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-[200px]" align="start">
      <DropdownMenuLabel>{{ title }}</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuGroup class="max-h-[300px] overflow-y-auto">
        <DropdownMenuCheckboxItem
          v-for="option in options"
          :key="String(option.value)"
          :checked="selectedValues.has(option.value)"
          @update:checked="(checked: boolean) => handleSelect(checked, option.value)"
        >
          <component
            v-if="option.icon"
            :is="option.icon"
            class="mr-2 h-4 w-4 text-muted-foreground"
          />
          <span>{{ option.label }}</span>
          <span
            v-if="facets?.get(option.value)"
            class="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs"
          >
            {{ facets.get(option.value) }}
          </span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>

      <template v-if="selectedValues.size > 0">
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            class="justify-center text-center cursor-pointer"
            @select="column?.setFilterValue(undefined)"
          >
            Clear filters
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts" generic="TData, TValue">
import type { Column } from '@tanstack/vue-table'
import { computed } from 'vue'
import { PlusCircle } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DataTableFilterOption } from '../types'

interface DataTableFacetedFilterProps {
  column?: Column<TData, TValue>
  title?: string
  options: DataTableFilterOption[]
}

const props = defineProps<DataTableFacetedFilterProps>()

const selectedValues = computed(() => {
  const filterValue = props.column?.getFilterValue()
  return new Set(Array.isArray(filterValue) ? filterValue : [])
})

const facets = computed(
  () => props.column?.getFacetedUniqueValues() as Map<any, number> | undefined,
)

function handleSelect(checked: boolean, value: any) {
  const filterValues = Array.from(selectedValues.value)

  if (checked) {
    filterValues.push(value)
  } else {
    const index = filterValues.indexOf(value)
    if (index > -1) {
      filterValues.splice(index, 1)
    }
  }

  props.column?.setFilterValue(filterValues.length ? filterValues : undefined)
}
</script>
