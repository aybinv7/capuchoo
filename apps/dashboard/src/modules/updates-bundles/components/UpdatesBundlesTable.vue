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
import { toast } from "vue-sonner";
import { updatesBundlesColumns } from "./UpdatesBundlesTable/updates-bundles.columns";
import type { UpdateOrBundle } from "../types/updates-bundles.types";
import {
  useUpdateBundleMutation,
  useUpdateNativeUpdateMutation,
} from "../composables/useUpdatesBundlesQuery";

const { mutateAsync: updateBundle } = useUpdateBundleMutation();
const { mutateAsync: updateNative } = useUpdateNativeUpdateMutation();

const router = useRouter();
const dataTableRef = ref();
const selectedItems = ref<UpdateOrBundle[]>([]);
const deleteDialogOpen = ref(false);
const bulkEditDialogOpen = ref(false);
const itemToDelete = ref<string | null>(null);
const itemToPromote = ref<string | null>(null);
const promoteDialogOpen = ref(false);
const isDeleting = ref(false);

const bulkEditData = ref({
  channel: "",
  required: "",
  active: "",
});

const props = defineProps<{
  items: UpdateOrBundle[];
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: "deleteItem", id: string, type: "bundle" | "native"): void;
  (e: "updateItem", item: UpdateOrBundle): void;
  (e: "refresh"): void;
}>();

const handleSelectionChange = (selection: UpdateOrBundle[]) => {
  selectedItems.value = selection;
};

const handleRowClick = (item: UpdateOrBundle) => {
  // Navigate to the detail page with type query param
  router.push(`/updates-bundles/${item.id}?type=${item.type}`);
};

const handleBulkEdit = () => {
  bulkEditDialogOpen.value = true;
  bulkEditData.value = {
    channel: "",
    required: "",
    active: "",
  };
};

/**
 * Applies the bulk edit, which it did not do before.
 *
 * This logged the intended change to the console, closed the dialog and
 * cleared the selection - so "Save changes" reported success and wrote nothing.
 * The same shape as the delete beside it: not a dead button, which teaches you
 * it is dead, but one that lies every time.
 *
 * Only the fields the operator actually set are sent. The dialog starts them
 * empty and empty means "leave alone", so spreading the whole form would push
 * `channel: ""` onto every selected release.
 */
const handleBulkEditConfirm = async () => {
  const changes: Record<string, unknown> = {};
  if (bulkEditData.value.channel) changes.channel = bulkEditData.value.channel;
  if (bulkEditData.value.required) changes.required = bulkEditData.value.required === "true";
  if (bulkEditData.value.active) changes.active = bulkEditData.value.active === "true";

  if (Object.keys(changes).length === 0) {
    bulkEditDialogOpen.value = false;
    return;
  }

  const targets = [...selectedItems.value];
  let failed = 0;

  for (const item of targets) {
    try {
      if (item.type === "native") await updateNative({ id: item.id, data: changes as never });
      else await updateBundle({ id: item.id, data: changes as never });
    } catch {
      failed += 1;
    }
  }

  // Counted rather than swallowed: a partial failure across a selection is the
  // case where "it worked" is most misleading.
  if (failed === 0) toast.success(`Updated ${targets.length} release(s)`);
  else toast.error(`${failed} of ${targets.length} could not be updated`);

  bulkEditDialogOpen.value = false;
  clearSelection();
  emit("updateItem", {} as never);
};

const handleBulkExport = () => {
  console.warn(
    "Exporting items:",
    selectedItems.value.map((p) => p.id),
  );
  const csv = selectedItems.value
    .map(
      (p) =>
        `${p.id},${p.type},${p.version_name},${p.platform},${p.channel},${p.required},${p.active}`,
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "updates-bundles.csv";
  a.click();
};

const handleBulkDelete = () => {
  itemToDelete.value = null;
  deleteDialogOpen.value = true;
};

const handleDeleteConfirm = async () => {
  isDeleting.value = true;

  try {
    if (itemToDelete.value) {
      // Single item delete
      const item = props.items.find((i) => i.id === itemToDelete.value);
      if (item) {
        emit("deleteItem", item.id, item.type);
      }
    } else {
      // Bulk delete
      selectedItems.value.forEach((item) => {
        emit("deleteItem", item.id, item.type);
      });
    }

    clearSelection();
  } catch (error) {
    console.error("Delete error:", error);
  } finally {
    isDeleting.value = false;
    deleteDialogOpen.value = false;
    itemToDelete.value = null;
  }
};

const clearSelection = () => {
  if (dataTableRef.value) {
    dataTableRef.value.clearSelection();
  }
  selectedItems.value = [];
};

const handlePromoted = () => {
  clearSelection();
  emit("updateItem", {} as any);
};

const triggerDelete = (itemId: string) => {
  itemToDelete.value = itemId;
  deleteDialogOpen.value = true;
};

const triggerPromote = (itemId: string) => {
  itemToPromote.value = itemId;
  promoteDialogOpen.value = true;
};

defineExpose({
  triggerDelete,
  triggerPromote,
  clearSelection,
});
</script>
