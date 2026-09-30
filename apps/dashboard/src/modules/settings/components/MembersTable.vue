<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import type { OrgRole } from "@/shared/types/session";
import { MEMBER_COLUMNS } from "../lib/member-columns";
import type { Member } from "../types/settings.types";

const props = defineProps<{
  members: readonly Member[];
  selfId: string | null;
  actorRole: OrgRole | null;
  pendingUserId: string | null;
  /** Bumped after a refused change so the selects show the stored role again. */
  revision: number;
}>();

const emit = defineEmits<{ role: [member: Member, role: OrgRole]; remove: [member: Member] }>();

const ROLES: OrgRole[] = ["member", "admin", "owner"];
const FACETS: DataTableFacet[] = [{ columnId: "role", title: "Role" }];

/** The server's rules, used only to avoid offering what it refuses. */
function canEdit(member: Member): boolean {
  if (props.actorRole === "owner") return true;
  if (props.actorRole !== "admin") return false;
  return member.role !== "owner";
}

function onRole(member: Member, value: unknown) {
  if (value === "member" || value === "admin" || value === "owner") emit("role", member, value);
}
</script>

<template>
  <DataTable
    :data="props.members"
    :columns="MEMBER_COLUMNS"
    :get-row-id="(member) => member.user_id"
    table-id="organization-members"
    export-name="organization-members"
    :facets="FACETS"
    :features="{ pinning: false, reorder: false }"
    search-placeholder="Name or email"
    :page-size="10"
    height="32rem"
  >
    <template #cell-member="{ row }">
      <div class="font-medium">
        {{ row.users.full_name || row.users.email }}
        <span v-if="row.user_id === props.selfId" class="text-muted-foreground text-xs font-normal"
          >(you)</span
        >
      </div>
      <div v-if="row.users.full_name" class="text-muted-foreground text-xs">
        {{ row.users.email }}
      </div>
    </template>
    <template #cell-role="{ row }">
      <NativeSelect
        v-if="canEdit(row)"
        :key="`${row.role}:${props.revision}`"
        :model-value="row.role"
        class="h-8 w-32"
        :disabled="props.pendingUserId === row.user_id"
        :aria-label="`Role of ${row.users.email}`"
        @update:model-value="onRole(row, $event)"
      >
        <NativeSelectOption
          v-for="role in ROLES"
          :key="role"
          :value="role"
          :disabled="role === 'owner' && props.actorRole !== 'owner'"
          >{{ role }}</NativeSelectOption
        >
      </NativeSelect>
      <span v-else class="text-sm">{{ row.role }}</span>
    </template>
    <template #cell-actions="{ row }">
      <Button
        v-if="row.user_id === props.selfId || canEdit(row)"
        variant="ghost"
        size="sm"
        class="text-destructive"
        @click="emit('remove', row)"
      >
        {{ row.user_id === props.selfId ? "Leave" : "Remove" }}
      </Button>
    </template>
  </DataTable>
</template>
