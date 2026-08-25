/**
 * @capuchoo/core - the contract shared by every part of Capuchoo.
 *
 * Runtime-agnostic and dependency-free on purpose: the CLI imports it in Node,
 * the updater imports it inside a Capacitor WebView, and the backend and
 * dashboard can import it in their own environments. Nothing here touches the
 * filesystem, the network, or a framework.
 */

export {
  environmentMismatchWarning,
  hasEnvironmentMismatch,
  suggestEnvironment,
  type EnvironmentSelection,
} from "./channel-environment.js";

export {
  UPDATE_EVENTS,
  UPDATE_EVENT_REQUIRED,
  UpdateMessage,
  parseUpdateEvent,
  resolveUpdate,
  isBlockingResponse,
  type Environment,
  type NativeUpdatePayload,
  type Platform,
  type ResolvedUpdate,
  type UpdateCheckRequest,
  type UpdateCheckResponse,
  type UpdateEvent,
  type UpdateEventPayload,
  type UpdateKind,
  type UpdateMessageValue,
  type UpdateResponseKind,
} from "./update-contract.js";

export {
  decideUpdate,
  describeDecision,
  nativePayload,
  renderUpdateResponse,
  type ChannelState,
  type DeviceState,
  type NativeRelease,
  type OtaRelease,
  type RenderContext,
  type UpdateDecision,
  type UpdateFacts,
} from "./update-decision.js";

export {
  DEFAULT_CHANNELS,
  ENVIRONMENTS,
  PROJECT_CONFIG_VERSION,
  defaultFlavour,
  describeEnvironmentMismatch,
  environmentFromAppId,
  isEnvironmentAllowed,
  isValidBundleId,
  normaliseProjectConfig,
  validateProjectConfig,
  type BuildConfig,
  type FlavourConfig,
  type ProjectConfig,
  type ResolvedProjectConfig,
} from "./project-config.js";

export {
  INITIAL_VERSION_CODES,
  bumpVersion,
  compareVersions,
  formatVersion,
  nextVersionCode,
  parseVersion,
  versionEnv,
  type BumpType,
  type SemanticVersion,
  type VersionCodes,
} from "./version.js";

export {
  APP_CREATOR_ROLES,
  canCreateApps,
  type CloudApp,
  type CloudChannel,
  type CloudOrganization,
  type CloudRelease,
  type CloudUser,
  type UserProfile,
  type CredentialScope,
  canPublishTo,
} from "./cloud.js";
