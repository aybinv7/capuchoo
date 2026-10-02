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
  isValidBundleId,
  normaliseProjectConfig,
  validateProjectConfig,
  type BuildConfig,
  type FlavourConfig,
  type ProjectConfig,
  type ProjectRuntime,
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

export {
  APP_FLAVOURS,
  describeFlavourMismatch,
  describeUploadFlavourMismatch,
  isFlavour,
  isFlavourAllowed,
  toAppIdentity,
  type AppFlavour,
  type AppIdentity,
  type IdentityRow,
} from "./app-identity.js";

export {
  adoptionReparents,
  decideAppRegistration,
  describeAdoption,
  describeAppConflict,
  type AdoptionReason,
  type AppRegistration,
  type AppRegistrationFacts,
  type ExistingApp,
} from "./app-registration.js";

export {
  APP_ROLE_ORDER,
  canIssueCap,
  describeCap,
  effectiveRole,
  isAppRole,
  roleRank,
  type AppRole,
} from "./role-cap.js";

export {
  checkNativeGate,
  type NativeGate,
  type NativeGateFacts,
  type NativeGateVerdict,
} from "./native-gate.js";

export {
  classifyUpdateEvent,
  successRate,
  summariseEvents,
  type EventSummary,
  type UpdateEventCategory,
} from "./update-events.js";

export {
  canPoint,
  type ArtefactKind,
  type ChannelKind,
  type PointerArtefact,
  type PointerChannel,
  type PointerFacts,
  type PointerRefusal,
  type PointerVerdict,
} from "./channel-pointer.js";

export {
  generateReleaseKeyPair,
  pemBody,
  publicKeyFingerprint,
  publicKeyFor,
  releaseSignaturePayload,
  signRelease,
  verifyRelease,
  type ReleaseClaim,
  type ReleaseKind,
} from "./release-signing.js";

export {
  BUILD_SOURCES,
  BUILD_STATUSES,
  CI_PROVIDERS,
  JOB_STATUSES,
  PIPELINE_PLAN_LIMITS,
  isBuildSource,
  isBuildStatus,
  isJobStatus,
  isTerminalBuildStatus,
  isTerminalJobStatus,
  matchPlanJob,
  mergeBuildStatus,
  mergeJobStatus,
  parsePipelinePlan,
  planColumns,
  planEdges,
  type BuildSource,
  type BuildStatus,
  type CiProvider,
  type JobStatus,
  type PipelinePlan,
  type PipelinePlanJob,
  type PipelineStep,
} from "./pipeline.js";

export {
  CI_BUILD_TYPES,
  CI_RUN_ACTIONS,
  GITHUB_WORKFLOW_INPUTS,
  GITLAB_PIPELINE_VARIABLES,
  describeCiRun,
  githubDispatchInputs,
  gitlabPipelineVariables,
  parseCiRunRequest,
  type CiBuildType,
  type CiRunAction,
  type CiRunRequest,
  type CiRunRequestResult,
} from "./ci-run.js";

export {
  GITHUB_WORKFLOW_PATH,
  GITHUB_WORKFLOW_SECRETS,
  GITHUB_WORKFLOW_VARIABLE,
  renderGithubWorkflow,
  resolveGithubWorkflowOptions,
  type GithubWorkflowOptions,
  type GithubWorkflowSecret,
} from "./github-workflow.js";

export {
  DEVICE_ATTRIBUTE_LIMITS,
  applyAttributePatch,
  normaliseDeviceAttributes,
  type DeviceAttributePatch,
  type DeviceAttributeValue,
  type DeviceAttributes,
  type NormalisedAttributes,
} from "./device-attributes.js";
