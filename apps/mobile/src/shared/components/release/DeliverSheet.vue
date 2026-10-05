<template>
  <F7Sheet
    :opened="Boolean(channel)"
    swipe-to-close
    backdrop
    push
    class="deliver-sheet"
    style="height: auto; max-height: 80vh"
    @sheet:closed="emit('close')"
  >
    <div class="swipe-handler" />
    <F7PageContent class="pb-6!">
      <div v-if="channel" class="px-6 pt-1 pb-3">
        <p class="text-[22px] leading-7 font-semibold">
          {{ t("deliver.sheetTitle", { channel: channel.name }) }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t("deliver.sheetText") }}</p>
      </div>
      <F7List v-if="eligible.length" dividers media-list class="deliver-list my-0!">
        <F7ListItem
          v-for="build in eligible"
          :key="build.id"
          :link="build.id === channel?.current_native_id ? false : '#'"
          :no-chevron="true"
          @click="build.id !== channel?.current_native_id && emit('pick', build, isRollback(build))"
        >
          <template #media>
            <span
              class="grid size-10 place-items-center rounded-full"
              :class="
                build.id === channel?.current_native_id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              "
            >
              <F7Icon
                :md="
                  build.id === channel?.current_native_id ? 'material:check' : 'material:android'
                "
                size="20"
              />
            </span>
          </template>
          <template #title>
            <span class="cap-mono font-semibold">{{ build.version_name }}</span>
          </template>
          <template #after>
            <span
              v-if="build.id === channel?.current_native_id"
              class="text-xs font-semibold text-primary"
              >{{ t("deliver.current") }}</span
            >
            <span v-else-if="isRollback(build)" class="text-xs font-semibold text-destructive">{{
              t("deliver.rollback")
            }}</span>
          </template>
          <template #subtitle>
            <span class="cap-mono text-xs"
              >#{{ build.version_code }} · {{ formatRelative(build.created_at, locale) }}</span
            >
          </template>
        </F7ListItem>
      </F7List>
      <F7BlockFooter v-else>{{ t("deliver.none") }}</F7BlockFooter>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import type { Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import { formatRelative } from "@/shared/utils/format";

/**
 * The builds a channel can be pointed at: its environment's flavour, or builds every flavour
 * shares. A lower build than the one it serves is a rollback and says so.
 */
const props = defineProps<{ channel: Channel | null; builds: NativeBuild[] }>();
const emit = defineEmits<{ close: []; pick: [build: NativeBuild, rollback: boolean] }>();
const { t, locale } = useI18n();

const current = computed(
  () => props.builds.find((build) => build.id === props.channel?.current_native_id) ?? null,
);

const eligible = computed(() =>
  props.builds.filter(
    (build) =>
      !build.flavour || !props.channel?.environment || build.flavour === props.channel.environment,
  ),
);

function isRollback(build: NativeBuild): boolean {
  return Boolean(current.value && build.version_code < current.value.version_code);
}
</script>

<style scoped>
.deliver-list {
  --f7-list-bg-color: transparent;
}
</style>
