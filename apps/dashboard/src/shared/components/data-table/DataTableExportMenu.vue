<script setup lang="ts">
import { Braces, Download, FileSpreadsheet } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "./types";

const props = defineProps<{ scope: string; disabled: boolean }>();
const emit = defineEmits<{ export: [format: ExportFormat] }>();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="h-8" :disabled="props.disabled">
        <Download />
        <span class="hidden lg:inline">Export</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuLabel class="text-muted-foreground text-xs font-normal">{{
        props.scope
      }}</DropdownMenuLabel>
      <DropdownMenuItem @select="emit('export', 'csv')">
        <FileSpreadsheet />
        CSV (Excel, Sheets)
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('export', 'json')">
        <Braces />
        JSON
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
