/** The viewer's IANA zone, so day boundaries are theirs; UTC when the runtime cannot tell. */
export function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
