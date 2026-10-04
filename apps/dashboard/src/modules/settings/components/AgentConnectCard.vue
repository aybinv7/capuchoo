<script setup lang="ts">
import { Bot } from "@lucide/vue";
import { computed, ref } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CopyButton from "@/shared/components/CopyButton.vue";
import CopyField from "@/shared/components/CopyField.vue";

type Client = "claude-ai" | "claude-code" | "cursor" | "claude-desktop";

const endpoint = `${window.location.origin}/api/mcp`;
const KEY = "cap_your_key";
const client = ref<Client>("claude-ai");

const snippets = computed<Record<Client, { where: string; code: string }>>(() => ({
  "claude-ai": {
    where:
      "In Settings, Connectors, Add custom connector: paste the endpoint, choose No sign-in, and add this request header:",
    code: `Authorization: Bearer ${KEY}`,
  },
  "claude-code": {
    where: "In a terminal:",
    code: `claude mcp add --transport http capuchoo ${endpoint} --header "Authorization: Bearer ${KEY}"`,
  },
  cursor: {
    where: "In ~/.cursor/mcp.json:",
    code: JSON.stringify(
      { mcpServers: { capuchoo: { url: endpoint, headers: { Authorization: `Bearer ${KEY}` } } } },
      null,
      2,
    ),
  },
  "claude-desktop": {
    where: "In claude_desktop_config.json (Settings, Developer, Edit config):",
    code: JSON.stringify(
      {
        mcpServers: {
          capuchoo: {
            command: "npx",
            args: ["mcp-remote", endpoint, "--header", "Authorization:${CAPUCHOO_AUTH}"],
            env: { CAPUCHOO_AUTH: `Bearer ${KEY}` },
          },
        },
      },
      null,
      2,
    ),
  },
}));
</script>

<template>
  <section class="bg-card space-y-4 rounded-lg border p-5">
    <header class="flex items-start gap-3">
      <span class="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
        <Bot class="size-5" />
      </span>
      <div class="space-y-1">
        <h2 class="text-sm font-semibold">Connect an AI agent</h2>
        <p class="text-muted-foreground max-w-2xl text-sm text-pretty">
          Capuchoo speaks the Model Context Protocol. An agent with a key can read your apps,
          releases, devices, sessions and errors, follow a crash from its replay to the line that
          threw, and, with the role for it, deliver or roll back after you confirm a preview.
        </p>
      </div>
    </header>

    <CopyField :value="endpoint" label="MCP endpoint" />

    <Tabs v-model="client" class="gap-3">
      <TabsList>
        <TabsTrigger value="claude-ai">Claude</TabsTrigger>
        <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
        <TabsTrigger value="cursor">Cursor</TabsTrigger>
        <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
      </TabsList>
      <TabsContent v-for="(snippet, id) in snippets" :key="id" :value="id" class="space-y-2">
        <p class="text-muted-foreground text-xs">{{ snippet.where }}</p>
        <div class="bg-muted/50 relative rounded-md border">
          <pre
            class="overflow-x-auto p-3 pr-10 font-mono text-xs leading-relaxed"
          ><code>{{ snippet.code }}</code></pre>
          <CopyButton :value="snippet.code" label="setup" class="absolute top-2 right-2" />
        </div>
      </TabsContent>
    </Tabs>

    <p class="text-muted-foreground text-xs text-pretty">
      Replace <span class="font-mono">{{ KEY }}</span> with a key from this page. Cap it at
      <span class="text-foreground font-medium">viewer</span> for an agent that only reads, and
      limit it to one app if it only needs one. A
      <span class="text-foreground font-medium">developer</span>
      key can also deliver, roll back and pause: each move answers with a preview first, and
      production needs the channel's name typed.
    </p>
  </section>
</template>
