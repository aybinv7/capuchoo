const CLIENT_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export interface ClientTarget {
  client: string;
  channel: string;
}

/** `acme,beta` to client targets on `prod-<client>` channels; throws on an unusable name. */
export function parseClients(value: string | undefined): ClientTarget[] {
  if (!value) return [];
  const seen = new Set<string>();
  const targets: ClientTarget[] = [];

  for (const raw of value.split(",")) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!CLIENT_NAME.test(name)) {
      throw new Error(
        `"${raw.trim()}" is not a usable client name: lowercase letters, digits and "-".`,
      );
    }
    const client = name.startsWith("prod-") ? name.slice(5) : name;
    if (!client || seen.has(client)) continue;
    seen.add(client);
    targets.push({ client, channel: `prod-${client}` });
  }

  return targets;
}
