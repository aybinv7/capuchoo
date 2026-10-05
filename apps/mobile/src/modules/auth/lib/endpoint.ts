/** `updates.example.com` becomes `https://updates.example.com`; a trailing slash is dropped. */
export function normaliseEndpoint(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname ? `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}` : null;
  } catch {
    return null;
  }
}

export function hostOf(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//, "");
}
