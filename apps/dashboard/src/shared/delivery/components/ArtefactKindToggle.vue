<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ArtefactKind } from "../lib/eligibility";

const kind = defineModel<ArtefactKind>({ required: true });

function select(value: unknown) {
  if (value === "ota" || value === "native") kind.value = value;
}
</script>

<template>
  <ToggleGroup
    :model-value="kind"
    type="single"
    variant="outline"
    size="sm"
    @update:model-value="select"
  >
    <ToggleGroupItem value="ota">OTA bundles</ToggleGroupItem>
    <ToggleGroupItem value="native">Native builds</ToggleGroupItem>
  </ToggleGroup>
</template>
