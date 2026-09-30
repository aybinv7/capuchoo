<script setup lang="ts" generic="T">
import { RotateCcw, Settings2 } from "@lucide/vue";
import type { Table } from "@tanstack/vue-table";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const props = defineProps<{ table: Table<T> }>();
const emit = defineEmits<{ reset: [] }>();

const columns = computed(() =>
  props.table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && !column.columnDef.meta?.fixed),
);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="h-8">
        <Settings2 />
        <span class="hidden lg:inline">View</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuLabel class="text-muted-foreground text-xs">Columns</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        v-for="column in columns"
        :key="column.id"
        :model-value="column.getIsVisible()"
        @update:model-value="(value: boolean) => column.toggleVisibility(value)"
        @select.prevent
      >
        {{ column.columnDef.meta?.title ?? column.id }}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="emit('reset')">
        <RotateCcw />
        Reset columns
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
