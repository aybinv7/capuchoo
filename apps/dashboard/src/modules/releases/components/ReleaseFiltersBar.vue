<script setup lang="ts">
import { Search } from "@lucide/vue";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ENVIRONMENT_ORDER } from "@/shared/lib/channels";
import type { ReleaseFilters } from "../types/releases.types";

const filters = defineModel<ReleaseFilters>({ required: true });
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <InputGroup class="w-64">
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput
        v-model="filters.search"
        placeholder="Version, build number, notes"
        aria-label="Search releases"
      />
    </InputGroup>
    <NativeSelect v-model="filters.flavour" class="h-9 w-40" aria-label="Flavour">
      <NativeSelectOption value="all">All flavours</NativeSelectOption>
      <NativeSelectOption v-for="env in ENVIRONMENT_ORDER" :key="env" :value="env">{{
        env
      }}</NativeSelectOption>
    </NativeSelect>
    <NativeSelect v-model="filters.platform" class="h-9 w-40" aria-label="Platform">
      <NativeSelectOption value="all">All platforms</NativeSelectOption>
      <NativeSelectOption value="android">Android</NativeSelectOption>
      <NativeSelectOption value="ios">iOS</NativeSelectOption>
      <NativeSelectOption value="web">Web</NativeSelectOption>
    </NativeSelect>
  </div>
</template>
