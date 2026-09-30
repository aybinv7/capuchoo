<script setup lang="ts">
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrgRole } from "@/shared/types/session";
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
  <div class="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader class="bg-surface">
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead class="w-40">Role</TableHead>
          <TableHead class="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="member in props.members" :key="member.user_id">
          <TableCell>
            <div class="font-medium">
              {{ member.users.full_name || member.users.email }}
              <span
                v-if="member.user_id === props.selfId"
                class="text-muted-foreground text-xs font-normal"
                >(you)</span
              >
            </div>
            <div v-if="member.users.full_name" class="text-muted-foreground text-xs">
              {{ member.users.email }}
            </div>
          </TableCell>
          <TableCell>
            <NativeSelect
              v-if="canEdit(member)"
              :key="`${member.role}:${props.revision}`"
              :model-value="member.role"
              class="h-8 w-32"
              :disabled="props.pendingUserId === member.user_id"
              :aria-label="`Role of ${member.users.email}`"
              @update:model-value="onRole(member, $event)"
            >
              <NativeSelectOption
                v-for="role in ROLES"
                :key="role"
                :value="role"
                :disabled="role === 'owner' && props.actorRole !== 'owner'"
                >{{ role }}</NativeSelectOption
              >
            </NativeSelect>
            <span v-else class="text-sm">{{ member.role }}</span>
          </TableCell>
          <TableCell class="text-right">
            <Button
              v-if="member.user_id === props.selfId || canEdit(member)"
              variant="ghost"
              size="sm"
              class="text-destructive"
              @click="emit('remove', member)"
            >
              {{ member.user_id === props.selfId ? "Leave" : "Remove" }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
