import type {
  AppRole,
  CloudApp,
  CloudChannel,
  CloudOrganization,
  CloudRelease,
  Environment,
  UserProfile,
} from "@capuchoo/core";
import { HttpError, del, get, post, put, uploadArtifact, type HttpOptions } from "../utils/http.js";

export type OrgRole = "owner" | "admin" | "member";
export type { AppRole } from "@capuchoo/core";

/** A row of organization_members or app_permissions, joined with its user. */
export interface Membership {
  user_id: string;
  role: string;
  users?: { id: string; email: string; full_name?: string | null } | null;
}

export type AppFlavour = "prod" | "staging" | "dev";

export interface AppIdentifierRow {
  id?: string;
  bundle_id: string;
  platform?: string | null;
  /** null when every flavour ships under this identifier. */
  flavour?: string | null;
  created_at?: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  key_prefix?: string;
  app_id?: string | null;
  /** Role ceiling, or null when the key carries the account's own rights. */
  role?: string | null;
  created_at?: string;
  last_used_at?: string | null;
}

/**
 * The Capuchoo API client.
 *
 * Replaces the previous split between `CloudService`, `CloudConfigService`,
 * `ChannelService` and `AuthService`. Those overlapped: two of them fetched
 * channels, `ChannelService` called a `/api/channel` endpoint the backend does
 * not implement and silently returned `["development", "staging", "production"]`
 * on failure - hard-coded names that then failed validation server-side - and
 * `CloudConfigService` cached a `/api/project/config` response nobody read.
 */
export class CloudClient {
  private readonly options: HttpOptions;

  constructor(endpoint: string, apiKey: string) {
    this.options = { endpoint, apiKey };
  }

  get endpoint(): string {
    return this.options.endpoint;
  }

  /**
   * The signed-in account, or null when the server refuses these credentials.
   *
   * `null` means the server answered and said no. Anything else - a timeout, a
   * 502 from a service waking up, DNS - throws, because it is a failure to *ask*
   * and not an answer.
   *
   * This used to swallow every error into `null`, so `doctor` reported
   * "Credentials rejected - the endpoint did not accept the stored API key" for
   * a backend that was merely asleep. The key was valid; the same command
   * succeeded on the next run. A wrong diagnosis is worse than none, because it
   * sends you looking in the wrong place with confidence.
   */
  async whoami(): Promise<UserProfile | null> {
    try {
      return await get<UserProfile>("/api/auth/me", this.options);
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Exchanges an email and password for a session token.
   *
   * Static because it runs before any credential exists: the whole point is to
   * get one. `authenticate` accepts the returned Supabase JWT wherever it accepts
   * an API key.
   */
  static async login(
    endpoint: string,
    email: string,
    password: string,
    timeoutMs?: number,
  ): Promise<{ token: string; user: { id: string; email: string } }> {
    const response = await post<{
      token?: string;
      user?: { id?: string; email?: string };
    }>("/api/auth/login", { email, password }, { endpoint, apiKey: "", timeoutMs });

    if (!response.token) throw new Error("The backend accepted the sign-in but returned no token");

    return {
      token: response.token,
      user: { id: response.user?.id ?? "", email: response.user?.email ?? email },
    };
  }

  /**
   * Mints an API key for the signed-in account.
   *
   * A JWT expires; a key does not, so the CLI stores the key and forgets the
   * token. Unscoped by default - the key acts as the account, and the app roles
   * are what restrict it.
   */
  createApiKey(input: {
    name: string;
    appId?: string | undefined;
    /** Ceiling on what the key may do. Omitted means the account's own rights. */
    role?: AppRole | undefined;
  }): Promise<{ key: string }> {
    return post<{ key: string }>(
      "/api/api-keys",
      {
        name: input.name,
        ...(input.appId ? { app_id: input.appId } : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      this.options,
    );
  }

  organizations(): Promise<CloudOrganization[]> {
    return get<CloudOrganization[]>("/api/organizations", this.options);
  }

  /**
   * Keys belonging to this account. The plain key is never returned again.
   *
   * Unwrapped here: this endpoint answers `{ success, keys }` while the member
   * and permission lists answer bare arrays.
   */
  async apiKeys(): Promise<ApiKeySummary[]> {
    const response = await get<{ keys?: ApiKeySummary[] } | ApiKeySummary[]>(
      "/api/api-keys",
      this.options,
    );

    return Array.isArray(response) ? response : (response.keys ?? []);
  }

  revokeApiKey(id: string): Promise<void> {
    return del(`/api/api-keys/${id}`, this.options);
  }

  orgMembers(organizationId: string): Promise<Membership[]> {
    return get<Membership[]>(`/api/organizations/${organizationId}/members`, this.options);
  }

  /** Adds by email; the server resolves it. Guarded by requireOrgAdmin. */
  addOrgMember(organizationId: string, email: string, role: OrgRole): Promise<unknown> {
    return post(`/api/organizations/${organizationId}/members`, { email, role }, this.options);
  }

  setOrgMemberRole(organizationId: string, userId: string, role: OrgRole): Promise<unknown> {
    return put(`/api/organizations/${organizationId}/members/${userId}`, { role }, this.options);
  }

  removeOrgMember(organizationId: string, userId: string): Promise<void> {
    return del(`/api/organizations/${organizationId}/members/${userId}`, this.options);
  }

  appPermissions(cloudAppId: string): Promise<Membership[]> {
    return get<Membership[]>(`/api/apps/${cloudAppId}/permissions`, this.options);
  }

  /** Grants by email. Guarded by requireAppAdmin. */
  grantAppRole(cloudAppId: string, email: string, role: AppRole): Promise<unknown> {
    return post(`/api/apps/${cloudAppId}/permissions`, { email, role }, this.options);
  }

  revokeAppRole(cloudAppId: string, userId: string): Promise<void> {
    return del(`/api/apps/${cloudAppId}/permissions/${userId}`, this.options);
  }

  apps(): Promise<CloudApp[]> {
    return get<CloudApp[]>("/api/apps", this.options);
  }

  createApp(input: {
    name: string;
    app_id: string;
    platform: string;
    organization_id: string;
  }): Promise<CloudApp> {
    return post<CloudApp>("/api/apps", input, this.options);
  }

  /** Guarded by requireAppAdmin server-side; cascades to channels and bundles. */
  deleteApp(cloudAppId: string): Promise<void> {
    return del(`/api/apps/${cloudAppId}`, this.options);
  }

  createOrganization(input: { name: string }): Promise<CloudOrganization> {
    return post<CloudOrganization>("/api/organizations", input, this.options);
  }

  /**
   * Creates a channel.
   *
   * `environment` is required by the server and by us: it is what selects the
   * build flavour, so a channel without one cannot be deployed to. The route
   * lives under /api/dashboard because the dashboard was its first caller - it
   * is a normal authenticated endpoint, not a UI-only one.
   */
  createChannel(input: {
    app_id: string;
    name: string;
    environment: Environment;
  }): Promise<CloudChannel> {
    return post<CloudChannel>("/api/dashboard/channels", input, this.options);
  }

  /** Scoped by app as well as id, so a stale id cannot delete another app's channel. */
  deleteChannel(channelId: string, cloudAppId: string): Promise<void> {
    return del(
      `/api/dashboard/channels/${channelId}?app_id=${encodeURIComponent(cloudAppId)}`,
      this.options,
    );
  }

  channels(cloudAppId: string): Promise<CloudChannel[]> {
    return get<CloudChannel[]>(`/api/apps/${cloudAppId}/channels`, this.options);
  }

  releases(cloudAppId: string, channel?: string): Promise<CloudRelease[]> {
    const query = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    return get<CloudRelease[]>(`/api/apps/${cloudAppId}/releases${query}`, this.options);
  }

  /**
   * Resolves a channel by name and rejects the ones that cannot be deployed to.
   *
   * A channel without an `environment` is unusable: the environment is what
   * selects the build flavour, so there would be nothing to build. The old code
   * checked this at two separate call sites with slightly different messages.
   */
  async requireChannel(cloudAppId: string, name: string): Promise<CloudChannel> {
    const channels = await this.channels(cloudAppId);
    const channel = channels.find((candidate) => candidate.name === name);

    if (!channel) {
      const available = channels.map((c) => c.name).join(", ") || "none";
      throw new Error(`Channel "${name}" does not exist for this app. Available: ${available}.`);
    }

    if (!channel.environment) {
      throw new Error(
        `Channel "${name}" has no environment set, so the CLI cannot tell which ` +
          "flavour to build. Set it in the dashboard, or recreate the channel with " +
          "capuchoo channel create.",
      );
    }

    return channel;
  }

  /** Registered bundle identifiers, and the flavour each declares. */
  identifiers(cloudAppId: string): Promise<AppIdentifierRow[]> {
    return get<AppIdentifierRow[]>(`/api/apps/${cloudAppId}/identifiers`, this.options);
  }

  /** `flavour` omitted means every flavour ships under this identifier. */
  registerIdentifier(
    cloudAppId: string,
    input: { bundle_id: string; platform?: string; flavour?: AppFlavour | null },
  ): Promise<AppIdentifierRow> {
    return post<AppIdentifierRow>(`/api/apps/${cloudAppId}/identifiers`, input, this.options);
  }

  removeIdentifier(cloudAppId: string, bundleId: string): Promise<void> {
    return del(`/api/apps/${cloudAppId}/identifiers/${encodeURIComponent(bundleId)}`, this.options);
  }

  uploadBundle(input: {
    filePath: string;
    appId: string;
    channel: string;
    platform: string;
    versionName: string;
    releaseNotes: string;
    active: boolean;
    required: boolean;
    /** The flavour this artefact was built from; the server refuses a mismatch. */
    flavour?: string | undefined;
  }) {
    return uploadArtifact(
      "/api/admin/upload",
      input.filePath,
      {
        app_id: input.appId,
        channel: input.channel,
        platform: input.platform,
        version_name: input.versionName,
        release_notes: input.releaseNotes,
        active: String(input.active),
        required: String(input.required),
        ...(input.flavour ? { flavour: input.flavour } : {}),
      },
      { ...this.options, fileField: "bundle" },
    );
  }

  uploadNative(input: {
    filePath: string;
    appId: string;
    channel: string;
    platform: string;
    versionName: string;
    versionCode: number;
    releaseNotes: string;
    active: boolean;
    required: boolean;
    flavour?: string | undefined;
  }) {
    return uploadArtifact(
      "/api/admin/native-upload",
      input.filePath,
      {
        app_id: input.appId,
        channel: input.channel,
        platform: input.platform,
        version_name: input.versionName,
        version_code: String(input.versionCode),
        release_notes: input.releaseNotes,
        active: String(input.active),
        required: String(input.required),
        ...(input.flavour ? { flavour: input.flavour } : {}),
      },
      { ...this.options, fileField: "bundle" },
    );
  }
}
