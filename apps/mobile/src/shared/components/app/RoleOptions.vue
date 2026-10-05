<template>
  <F7List strong inset dividers media-list class="role-options rounded-2xl!">
    <F7ListItem
      v-for="role in roles"
      :key="role"
      radio
      radio-icon="end"
      :name="name"
      :value="role"
      :checked="modelValue === role"
      :title="t(`roles.name.${role}`)"
      :text="t(`roles.purpose.${role}`)"
      @change="select(role)"
    >
      <template #media>
        <MaterialShape
          :shape="SHAPES[role]"
          class="grid size-10 place-items-center"
          :class="
            modelValue === role
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          "
        >
          <F7Icon :md="`material:${ICONS[role]}`" size="20" />
        </MaterialShape>
      </template>
    </F7ListItem>
  </F7List>
</template>

<script setup lang="ts">
import type { AppRole } from "@/shared/database/schema";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { tick } from "@/shared/utils/native/haptics";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/** App roles as M3 radio rows, each with what it lets someone do: a role is chosen by its reach. */
defineProps<{ roles: readonly AppRole[]; modelValue: AppRole | null; name: string }>();
const emit = defineEmits<{ "update:modelValue": [role: AppRole] }>();
const { t } = useI18n();

const ICONS: Record<AppRole, string> = {
  viewer: "visibility",
  tester: "bug_report",
  developer: "code",
  admin: "admin_panel_settings",
};

const SHAPES: Record<AppRole, MaterialShapeName> = {
  viewer: "circle",
  tester: "cookie9",
  developer: "clover4",
  admin: "sunny",
};

function select(role: AppRole): void {
  tick();
  emit("update:modelValue", role);
}
</script>
