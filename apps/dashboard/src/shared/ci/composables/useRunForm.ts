import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { isApiError } from "../../api/errors";
import { useCatalog } from "../../queries/useCatalog";
import { useCiRefs } from "../../queries/useAppCi";
import {
  channelForRef,
  createRunForm,
  describeRunForm,
  validateRunForm,
  versionFromRef,
  type RunContext,
  type RunForm,
  type RunFormField,
  type RunPreset,
} from "../lib/run-form";
import { clientChannels, releaseChannelGroups, suggestedDeliverVersion } from "../lib/run-targets";
import { useStartRun } from "./useStartRun";

const FIELDS = new Set<RunFormField>([
  "action",
  "ref",
  "channel",
  "versionMode",
  "version",
  "client",
  "notes",
  "buildType",
]);
const WIRE_FIELD: Record<string, RunFormField> = { build_type: "buildType" };
const REASON_FIELD: Record<string, RunFormField> = { unknown_channel: "channel" };

/**
 * The run dialog's state: the form, its targets from the catalog and the repository's refs, and
 * a submit that validates with core's rule and the workflow's prod rule before anything is sent.
 * The channel is filled from the ref whenever the app has the matching channel, since the server
 * authorizes a run without one as a prod run. Reset each time the dialog opens.
 */
export function useRunForm(
  appId: MaybeRefOrGetter<string>,
  open: MaybeRefOrGetter<boolean>,
  preset: MaybeRefOrGetter<RunPreset>,
) {
  const form = reactive<RunForm>(createRunForm());
  const attempted = ref(false);
  const versionEdited = ref(false);
  const channelEdited = ref(false);
  let versionFromTag = false;

  const refs = useCiRefs(appId, open);
  const { catalog } = useCatalog(appId);
  const start = useStartRun(appId);

  const refList = computed(() => refs.data.value ?? null);
  const context = computed<RunContext>(() => ({
    defaultBranch: refList.value?.default_branch ?? "",
    tags: refList.value?.tags ?? [],
    channels: catalog.value.channels,
  }));
  const channelGroups = computed(() => releaseChannelGroups(catalog.value.channels));
  const clients = computed(() => clientChannels(catalog.value.channels));
  const deliverSuggestion = computed(() =>
    form.action === "deliver" ? suggestedDeliverVersion(catalog.value, form.client) : null,
  );
  const derivedChannel = computed(() => channelForRef(form.ref, context.value));

  function reset() {
    const value = toValue(preset);
    Object.assign(form, createRunForm(value, refList.value?.default_branch ?? ""));
    attempted.value = false;
    versionEdited.value = false;
    channelEdited.value = Boolean(value.channel);
    versionFromTag = false;
    start.reset();
    followRef();
  }

  function followRef() {
    if (!channelEdited.value) form.channel = derivedChannel.value ?? "";
    if (versionEdited.value || form.action === "deliver") return;
    const tagged = versionFromRef(form.ref, context.value.tags);
    if (tagged) {
      form.versionMode = "exact";
      form.version = tagged;
      versionFromTag = true;
    } else if (versionFromTag) {
      form.versionMode = "ref";
      form.version = "";
      versionFromTag = false;
    }
  }

  watch(
    () => toValue(open),
    (value) => {
      if (value) reset();
    },
    { immediate: true },
  );

  watch(refList, (value) => {
    if (value && !form.ref) form.ref = toValue(preset).ref ?? value.default_branch;
  });

  watch([() => form.ref, derivedChannel], followRef);

  watch(
    () => form.action,
    (action) => {
      if (action === "deliver") {
        form.versionMode = "exact";
        if (!versionEdited.value) form.version = deliverSuggestion.value ?? "";
      } else if (form.versionMode === "exact" && !versionEdited.value) {
        form.versionMode = "ref";
        form.version = "";
        followRef();
      }
    },
  );

  watch(deliverSuggestion, (value) => {
    if (value && !versionEdited.value) form.version = value;
  });

  const validation = computed(() => validateRunForm(form, context.value));
  const summary = computed(() => describeRunForm(form, context.value));

  const serverField = computed<RunFormField | null>(() => {
    const error = start.error.value;
    if (!isApiError(error)) return null;
    const byReason = REASON_FIELD[error.reason];
    if (byReason) return byReason;
    const field = typeof error.details.field === "string" ? error.details.field : "";
    const mapped = WIRE_FIELD[field] ?? field;
    return FIELDS.has(mapped as RunFormField) ? (mapped as RunFormField) : null;
  });

  /** The message to show under `field`, once the person has tried to submit. */
  function errorFor(field: RunFormField): string | null {
    if (serverField.value === field && start.error.value instanceof Error)
      return start.error.value.message;
    if (!attempted.value) return null;
    const result = validation.value;
    return !result.ok && result.field === field ? result.message : null;
  }

  function submit(onStarted?: () => void) {
    attempted.value = true;
    const result = validation.value;
    if (!result.ok || start.isPending.value) return;
    start.mutate(result.request, { onSuccess: () => onStarted?.() });
  }

  return {
    form,
    refs,
    refList,
    channelGroups,
    clients,
    deliverSuggestion,
    derivedChannel,
    summary,
    start,
    serverField,
    errorFor,
    markVersionEdited: () => {
      versionEdited.value = true;
    },
    markChannelEdited: () => {
      channelEdited.value = true;
    },
    submit,
  };
}
