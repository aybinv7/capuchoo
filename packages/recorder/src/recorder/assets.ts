const MAX_IMAGES = 60;

/** Same-origin stylesheets and images on the page now: what a replay needs to look like the app. */
export function discoverAssetUrls(): string[] {
  if (typeof document === "undefined") return [];
  const urls = new Set<string>();
  const origin = location.origin;
  const add = (raw: string | null | undefined) => {
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin === origin) urls.add(url.href);
    } catch {
      return;
    }
  };

  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')) {
    add(link.href);
  }
  for (const sheet of Array.from(document.styleSheets)) add(sheet.href);
  let images = 0;
  for (const image of document.querySelectorAll<HTMLImageElement>("img[src]")) {
    if (images++ >= MAX_IMAGES) break;
    add(image.currentSrc || image.src);
  }
  return [...urls];
}
