import type {
  CloudApp,
  CloudChannel,
  CloudOrganization,
  CloudRelease,
  Environment,
  UserProfile,
} from "@capuchoo/core";
import { del, get, post, uploadArtifact, type HttpOptions } from "../utils/http.js";

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

  /** Verifies the credentials and returns the profile behind them. */
  async whoami(): Promise<UserProfile | null> {
    try {
      return await get<UserProfile>("/api/auth/me", this.options);
    } catch {
      return null;
    }
  }

  organizations(): Promise<CloudOrganization[]> {
    return get<CloudOrganization[]>("/api/organizations", this.options);
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

  uploadBundle(input: {
    filePath: string;
    appId: string;
    channel: string;
    platform: string;
    versionName: string;
    releaseNotes: string;
    active: boolean;
    required: boolean;
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
      },
      { ...this.options, fileField: "bundle" },
    );
  }
}
