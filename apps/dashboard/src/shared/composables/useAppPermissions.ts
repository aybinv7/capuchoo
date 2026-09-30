import type { Environment } from "@capuchoo/core";
import { computed } from "vue";
import {
  canAdministerApp,
  canAssignDevice,
  canDeleteRelease,
  canDeliver,
  canEditRelease,
  canManageChannels,
  canRemoveDevice,
  hasAppRole,
} from "../lib/roles";
import { useCurrentApp } from "./useCurrentApp";

/** Role gates for the current app. They decide what to offer; the server decides what happens. */
export function useAppPermissions() {
  const { role, prodRole } = useCurrentApp();

  return {
    role,
    prodRole,
    isAdmin: computed(() => hasAppRole(role.value, "admin")),
    manageChannels: computed(() => canManageChannels(role.value)),
    deleteRelease: computed(() => canDeleteRelease(role.value)),
    removeDevice: computed(() => canRemoveDevice(role.value)),
    administer: computed(() => canAdministerApp(role.value)),
    deliver: (environment: Environment) => canDeliver(role.value, environment, prodRole.value),
    editRelease: (flavour: Environment | null) =>
      canEditRelease(role.value, flavour, prodRole.value),
    assignDevice: (environment: Environment | null) =>
      canAssignDevice(role.value, environment, prodRole.value),
  };
}
