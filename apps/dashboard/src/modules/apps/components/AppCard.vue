<script setup lang="ts">
import { ArrowUpRight, ShieldCheck, ShieldOff } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { RouteName } from "@/shared/router/route-names";
import type { AppSummary } from "@/shared/types/session";

const props = defineProps<{ app: AppSummary }>();
</script>

<template>
  <RouterLink
    :to="{ name: RouteName.overview, params: { appId: props.app.id } }"
    class="group bg-card hover:border-foreground/20 focus-visible:ring-ring/50 flex flex-col gap-4 rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate font-medium">{{ props.app.name }}</h2>
        <p class="text-muted-foreground truncate font-mono text-xs">{{ props.app.app_id }}</p>
      </div>
      <ArrowUpRight
        class="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
    <dl class="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
      <div>
        <dt class="text-[10px] tracking-wide uppercase">Role</dt>
        <dd class="text-foreground font-medium">{{ props.app.role ?? "none" }}</dd>
      </div>
      <div>
        <dt class="text-[10px] tracking-wide uppercase">Prod delivery</dt>
        <dd class="text-foreground font-medium">{{ props.app.prod_role }}</dd>
      </div>
      <div>
        <dt class="text-[10px] tracking-wide uppercase">Signing</dt>
        <dd class="text-foreground flex items-center gap-1 font-medium">
          <template v-if="props.app.require_signature">
            <ShieldCheck class="text-success size-3.5" />
            required
          </template>
          <template v-else-if="props.app.has_public_key">
            <ShieldCheck class="size-3.5" />
            optional
          </template>
          <template v-else>
            <ShieldOff class="size-3.5" />
            off
          </template>
        </dd>
      </div>
    </dl>
  </RouterLink>
</template>
