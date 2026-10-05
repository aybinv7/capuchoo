import { Hammer, Package, RadioTower, Smartphone } from "@lucide/vue";
import { computed, type Ref } from "vue";
import { channelCurrent } from "../../delivery/lib/eligibility";
import { formatRelative } from "../../lib/format";
import { useBuilds } from "../../queries/useBuilds";
import { useCatalog } from "../../queries/useCatalog";
import { RouteName } from "../../router/route-names";
import type { SearchItem } from "../types";

/** Channels, releases and recent builds of the current app, from the cached queries. */
export function useCatalogItems(appId: Ref<string>) {
  const { catalog } = useCatalog(appId);
  const builds = useBuilds(appId);
  const now = Date.now();

  const channels = computed<SearchItem[]>(() =>
    catalog.value.channels.map((channel) => {
      const current = channelCurrent(channel, catalog.value);
      const versions = [
        current.bundle && `ota ${current.bundle.version_name}`,
        current.native && `native ${current.native.version_name}`,
      ].filter((entry): entry is string => Boolean(entry));
      return {
        id: `channel:${channel.id}`,
        scope: "channels",
        label: channel.name,
        hint: [channel.environment, channel.paused ? "paused" : null, ...versions]
          .filter(Boolean)
          .join(" · "),
        keywords: [channel.kind, channel.environment],
        icon: RadioTower,
        to: { name: RouteName.channel, params: { appId: appId.value, channelId: channel.id } },
      };
    }),
  );

  const releases = computed<SearchItem[]>(() =>
    [...catalog.value.bundles, ...catalog.value.natives].map((artefact) => ({
      id: `release:${artefact.id}`,
      scope: "releases",
      label:
        artefact.kind === "native"
          ? `${artefact.version_name} (${artefact.version_code})`
          : artefact.version_name,
      hint: [
        artefact.kind === "ota" ? "OTA bundle" : "Native build",
        artefact.flavour,
        artefact.platform,
      ]
        .filter(Boolean)
        .join(" · "),
      keywords: [artefact.release_notes ?? "", artefact.uploaded_by ?? ""],
      icon: artefact.kind === "ota" ? Package : Smartphone,
      recency: artefact.created_at ? Date.parse(artefact.created_at) : 0,
      to: {
        name: RouteName.releases,
        params: { appId: appId.value },
        query: {
          q: artefact.version_name,
          kind: artefact.kind === "native" ? "native" : undefined,
        },
      },
    })),
  );

  const buildItems = computed<SearchItem[]>(() =>
    (builds.data.value ?? []).map((build) => ({
      id: `build:${build.id}`,
      scope: "builds",
      label: `${build.kind} ${build.version_name ?? "build"}`,
      hint: [
        build.status,
        build.channel_name,
        formatRelative(build.started_at ?? build.created_at, now),
      ]
        .filter(Boolean)
        .join(" · "),
      keywords: [build.ref ?? "", build.commit_sha ?? "", build.actor_email ?? ""],
      icon: Hammer,
      recency: Date.parse(build.started_at ?? build.created_at),
      to: { name: RouteName.build, params: { appId: appId.value, buildId: build.id } },
    })),
  );

  return { channels, releases, builds: buildItems };
}
