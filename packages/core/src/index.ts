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

export {
  DEFAULT_RECORDING_POLICY,
  RECORDING_LIMITS,
  RECORDING_MODES,
  RECORDING_RULE_SCOPES,
  RECORDING_TRACKS,
  RECORDING_TRIGGERS,
  deviceSampleBucket,
  escalateMode,
  isRecordingMode,
  modeRank,
  normaliseRecordingPatch,
  resolveRecordingPolicy,
  type NormalisedRecordingPatch,
  type RecordingMode,
  type RecordingPolicy,
  type RecordingPolicyPatch,
  type RecordingRuleLayer,
  type RecordingRuleScope,
  type RecordingTrack,
  type RecordingTrigger,
  type ResolveRecordingContext,
  type ResolvedRecordingPolicy,
} from "./recording-policy.js";

export {
  RECORDING_ASSET_HEADER,
  RECORDING_HEADER,
  RECORDING_WIRE_LIMITS,
  decodeRecordingHeader,
  encodeRecordingHeader,
  isRecordingSessionId,
  parseRecordingAssetHeader,
  parseRecordingPolicyRequest,
  parseRecordingSegmentHeader,
  parseRecorderHealth,
  DATABASE_CAPTURE_STATES,
  type DatabaseCaptureState,
  type DatabaseHealth,
  type RecorderHealth,
  type RecordedEvent,
  type RecordedKind,
  type RecordingAssetHeader,
  type RecordingDeviceFacts,
  type RecordingPolicyRequest,
  type RecordingSegmentHeader,
  type RecordingSegmentMeta,
  type RecordingSessionMeta,
  type RecordingStart,
} from "./recording-wire.js";
export {
  ASSIST_KEYS,
  ASSIST_LIMITS,
  CONTROL_MESSAGES,
  parseAgentMessage,
  parseAssistHello,
  parseAssistInvite,
  parseDeviceMessage,
  type AgentMessage,
  type AssistControl,
  type AssistEndReason,
  type AssistHello,
  type AssistInvite,
  type AssistKey,
  type AssistRole,
  type DeviceMessage,
  type ServerMessage,
} from "./assist-protocol.js";
export {
  STEP_ACTIONS,
  parseRecordedStep,
  type RecordedStep,
  type StepAction,
  type StepTarget,
} from "./recording-steps.js";
export {
  RECORDING_ISSUE_LIMITS,
  issueOf,
  normaliseIssueMessage,
  parseRecordingIssues,
  topFrame,
  type RecordingIssue,
} from "./recording-issues.js";
