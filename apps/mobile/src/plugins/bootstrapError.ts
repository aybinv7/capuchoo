import {
  MINIMUM_CHROMIUM_FOR_OPFS,
  webviewLikelyTooOld,
  webviewVersion,
} from "@/shared/database/storage";

/**
 * The screen shown when the app cannot start, which in practice means the database did not open.
 *
 * Deliberately framework-free. Mounting the app to report the failure would run screens that assume
 * a working database, so a second failure would replace the first and the person would learn
 * nothing. Plain DOM cannot fail for the same reason twice.
 *
 * It replaces a red sentence in a bare div, which is what shipped before and told a field user
 * nothing they could act on.
 */
export function renderBootstrapError(error: unknown): void {
  const root = document.getElementById("app");
  if (!root) return;

  const message = error instanceof Error ? error.message : String(error);
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const version = webviewVersion();

  const advice = webviewLikelyTooOld()
    ? `This WebView is Chromium ${String(version)}. The app needs ${String(MINIMUM_CHROMIUM_FOR_OPFS)} or newer for local storage. Update Android System WebView in the Play Store - it updates separately from Android itself.`
    : "Closing the app completely and opening it again usually clears this. Your data has not been deleted.";

  root.replaceChildren();
  root.insertAdjacentHTML(
    "afterbegin",
    `<div style="font:15px/1.55 system-ui,-apple-system,sans-serif;padding:28px 22px;max-width:38rem;margin:0 auto;color:#1c1c1e">
      <div style="font-size:34px;line-height:1">&#9888;&#65039;</div>
      <h1 style="font-size:19px;margin:14px 0 6px">The app could not start</h1>
      <p style="margin:0 0 14px;color:#3a3a3c">${escapeHtml(message)}</p>
      <p style="margin:0 0 20px;color:#3a3a3c">${escapeHtml(advice)}</p>
      <button id="bootstrap-retry" style="appearance:none;border:0;border-radius:10px;background:#e2622a;color:#fff;font:600 15px system-ui;padding:12px 20px;width:100%">
        Try again
      </button>
      <details style="margin-top:20px;color:#6c6c70">
        <summary style="cursor:pointer;font-size:13px">Technical details</summary>
        <p style="font-size:12px;margin:8px 0 0">WebView: Chromium ${version === null ? "unknown" : String(version)}</p>
        <pre style="font-size:11px;white-space:pre-wrap;word-break:break-word;margin:8px 0 0">${escapeHtml(detail)}</pre>
      </details>
    </div>`,
  );

  document.getElementById("bootstrap-retry")?.addEventListener("click", () => {
    window.location.reload();
  });
}

/** The message can carry an engine's own text, and that text is not trusted markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
