<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { RouteName } from "@/shared/router/route-names";
import type { Build } from "@/shared/types/build";
import BuildSourceCell from "./BuildSourceCell.vue";

defineProps<{ builds: readonly Build[] }>();

const router = useRouter();
const open = (build: Build) =>
  router.push({ name: RouteName.build, params: { buildId: build.id } });
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader class="bg-surface">
        <TableRow>
          <TableHead class="w-28">Status</TableHead>
          <TableHead>Release</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead class="w-[30%]">Source</TableHead>
          <TableHead>By</TableHead>
          <TableHead class="text-right">Started</TableHead>
          <TableHead class="text-right">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="build in builds"
          :key="build.id"
          class="cursor-pointer"
          tabindex="0"
          @click="open(build)"
          @keydown.enter="open(build)"
        >
          <TableCell><BuildStatusBadge :status="build.status" /></TableCell>
          <TableCell>
            <div class="flex items-center gap-2">
              <span class="bg-muted rounded px-1 font-mono text-[10px] uppercase">{{
                build.kind
              }}</span>
              <span class="font-mono text-sm">{{ build.version_name ?? "—" }}</span>
              <span v-if="build.version_code" class="text-muted-foreground font-mono text-xs"
                >({{ build.version_code }})</span
              >
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs">{{ build.channel_name ?? "—" }}</span>
              <EnvBadge v-if="build.flavour" :environment="build.flavour" size="sm" />
            </div>
          </TableCell>
          <TableCell class="max-w-0"><BuildSourceCell :build="build" /></TableCell>
          <TableCell class="text-muted-foreground max-w-40 truncate text-xs">{{
            build.actor_email ?? (build.actor_api_key_id ? "API key" : "—")
          }}</TableCell>
          <TableCell class="text-muted-foreground text-right text-xs">
            <RelativeTime :value="build.started_at ?? build.created_at" />
          </TableCell>
          <TableCell class="text-muted-foreground text-right text-xs">
            <ElapsedTime :from="build.started_at ?? build.created_at" :to="build.finished_at" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
