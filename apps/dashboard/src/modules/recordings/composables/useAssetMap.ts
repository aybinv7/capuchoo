import type { SafeArea } from "@capuchoo/core";
import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { rewriteCss, type AssetMap } from "../lib/asset-rewrite";
import { assetUrl, fetchAssetText } from "../services/recordings.service";
import type { RecordingAsset } from "../types/recordings.types";

/**
 * Where the replay finds each file it references. Stylesheets are fetched, their `url()`s pointed at
 * the server's copies and their safe-area insets set to the phone's, and served from blob URLs,
 * because a font path relative to the stylesheet would otherwise resolve against the dashboard.
 */
export function useAssetMap(
  assets: Ref<readonly RecordingAsset[] | undefined>,
  safeArea?: Ref<SafeArea | null>,
) {
  const map = shallowRef<AssetMap>(new Map());
  const ready = ref(false);
  let blobs: string[] = [];
  let controller: AbortController | null = null;
  let resolvedFor = "";

  function release() {
    for (const url of blobs) URL.revokeObjectURL(url);
    blobs = [];
  }

  watch(
    [assets, () => safeArea?.value ?? null],
    async ([list, insets]) => {
      if (!list) return;
      const signature = `${list.map((asset) => asset.id).join(",")}|${JSON.stringify(insets)}`;
      if (signature === resolvedFor) return;
      resolvedFor = signature;
      if (list.length === 0) {
        controller?.abort();
        release();
        map.value = new Map();
        ready.value = true;
        return;
      }
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;

      const plain = new Map(list.map((asset) => [asset.path, assetUrl(asset.id)]));
      const stylesheets = list.filter((asset) => asset.content_type === "text/css");
      const next = new Map(plain);
      const created: string[] = [];
      await Promise.all(
        stylesheets.map(async (asset) => {
          try {
            const css = rewriteCss(
              await fetchAssetText(asset.id, signal),
              asset.path,
              plain,
              insets,
            );
            const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
            created.push(url);
            next.set(asset.path, url);
          } catch {
            return;
          }
        }),
      );
      if (signal.aborted) {
        for (const url of created) URL.revokeObjectURL(url);
        return;
      }
      release();
      blobs = created;
      map.value = next;
      ready.value = true;
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    controller?.abort();
    release();
  });

  return { map, ready };
}
