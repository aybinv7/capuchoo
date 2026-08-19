<template>
  <div v-if="sortable || filterable || groupable || pinnable" class="flex items-center space-x-2">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm" class="-ml-3 h-8 data-[state=open]:bg-accent">
          <span>{{ title }}</span>
          <ArrowDown v-if="column.getIsSorted() === 'desc'" class="ml-2 h-4 w-4" />
          <ArrowUp v-else-if="column.getIsSorted() === 'asc'" class="ml-2 h-4 w-4" />
          <ArrowUpDown v-else-if="sortable" class="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <!-- Sorting -->
        <template v-if="sortable">
          <DropdownMenuItem @click="column.toggleSorting(false)">
            <ArrowUp class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem @click="column.toggleSorting(true)">
            <ArrowDown class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="filterable || groupable || pinnable" />
        </template>

        <!-- Grouping -->
        <template v-if="groupable">
          <DropdownMenuItem v-if="!column.getIsGrouped()" @click="column.toggleGrouping()">
            <Group class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Group by {{ title }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="column.toggleGrouping()">
            <Ungroup class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Ungroup
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="pinnable || filterable" />
        </template>

        <!-- Pinning -->
        <template v-if="pinnable">
          <DropdownMenuItem :disabled="column.getIsPinned() === 'left'" @click="column.pin('left')">
            <Pin class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Pin to left
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="column.getIsPinned() === 'right'"
            @click="column.pin('right')"
          >
            <PinOff class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Pin to right
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!column.getIsPinned()" @click="column.pin(false)">
            <PinOff class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Unpin
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="filterable" />
        </template>

        <!-- Filtering -->
        <template v-if="filterable">
          <DropdownMenuItem @click="column.setFilterValue('')">
            <FilterX class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Clear filter
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>

        <!-- Hide column -->
        <DropdownMenuItem @click="column.toggleVisibility(false)">
          <EyeOff class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
          Hide column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <!-- Non-interactive header -->
  <div v-else>
    {{ title }}
  </div>
</template>
<script setup lang="ts">
import type { Column } from '@tanstack/vue-table'
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  EyeOff,
  FilterX,
  Group,
  Ungroup,
  Pin,
  PinOff,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DataTableColumnHeaderProps {
  column: Column<any, any>
  title: string
}

const props = defineProps<DataTableColumnHeaderProps>()

const sortable = computed(() => props.column.getCanSort())
const filterable = computed(() => props.column.getCanFilter())
const groupable = computed(() => props.column.getCanGroup())
const pinnable = computed(() => props.column.getCanPin())
</script>
