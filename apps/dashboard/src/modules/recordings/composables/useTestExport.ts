import { refDebounced, useStorage } from "@vueuse/core";
import { computed, ref, type Ref } from "vue";
import { formatDateTime } from "@/shared/lib/format";
import { sessionDeviceLabel } from "../lib/recording-columns";
import { FORMATS, isExportFormat, type ExportFormat } from "../lib/test-export/formats";
import { buildExportPlan } from "../lib/test-export/plan";
import type { Lanes, RecordingSession } from "../types/recordings.types";

const DEFAULT_BASE_URL = "http://localhost:5173";
/** Slider moves settle this long before the code is written again. */
const SETTLE_MS = 120;

/**
 * A value remembered per app: where its web build is served and its Android package differ
 * between apps, and typing them once per app is enough.
 */
function perApp(key: string, appId: Ref<string>, fallback: string) {
  const all = useStorage<Record<string, string>>(key, {});
  return computed({
    get: () => all.value[appId.value] ?? fallback,
    set: (value: string) => {
      all.value = { ...all.value, [appId.value]: value };
    },
  });
}

/** Everything the export dialog decides, and the test it produces, kept apart from its layout. */
export function useTestExport(input: {
  appId: Ref<string>;
  session: Ref<RecordingSession>;
  lanes: Ref<Lanes>;
  bounds: Ref<{ start: number; end: number }>;
  /** The viewport the app held longest, in CSS pixels. */
  viewport: Ref<{ width: number; height: number } | null>;
}) {
  const storedFormat = useStorage<string>("capuchoo.export.format", "playwright");
  const format = computed<ExportFormat>({
    get: () => (isExportFormat(storedFormat.value) ? storedFormat.value : "playwright"),
    set: (value) => {
      storedFormat.value = value;
    },
  });
  const complete = useStorage("capuchoo.export.complete", true);
  const stubs = useStorage("capuchoo.export.stubs", true);
  const baseUrl = perApp("capuchoo.export.baseUrl", input.appId, DEFAULT_BASE_URL);
  const appPackage = perApp("capuchoo.export.package", input.appId, "");

  const length = computed(() => input.bounds.value.end - input.bounds.value.start);
  /** Milliseconds from the session's start: where the exported stretch begins and ends. */
  const range = ref<[number, number]>([0, length.value]);
  const settled = refDebounced(range, SETTLE_MS);

  function reset(from = 0) {
    range.value = [Math.min(Math.max(0, from), length.value), length.value];
  }

  const info = computed(() => FORMATS[format.value]);
  const recordsSteps = computed(() => input.lanes.value.steps.length > 0);
  const hasBodies = computed(() =>
    input.lanes.value.network.some((entry) => entry.responseBody !== null),
  );

  const plan = computed(() => {
    const session = input.session.value;
    const screen = session.device?.screen ?? null;
    const shape = input.viewport.value ?? screen;
    return buildExportPlan({
      lanes: input.lanes.value,
      from: input.bounds.value.start + settled.value[0],
      to: input.bounds.value.start + settled.value[1],
      title: `${sessionDeviceLabel(session)} · ${session.version_name} · ${formatDateTime(session.started_at)}`,
      viewport: shape ? { width: shape.width, height: shape.height, dpr: screen?.dpr ?? 1 } : null,
      platform: session.platform,
      stubs: info.value.stubs && stubs.value,
    });
  });

  /** The user's own steps in the stretch: what the test does, not where it opens or checks. */
  const actions = computed(
    () => plan.value.steps.filter((step) => step.kind !== "visit" && step.kind !== "url").length,
  );

  const result = computed(() =>
    info.value.generate(plan.value, {
      complete: complete.value,
      baseUrl: baseUrl.value,
      appPackage: appPackage.value,
    }),
  );

  const fileName = computed(
    () => `session-${input.session.value.id.slice(0, 8)}${info.value.extension}`,
  );

  function download() {
    const blob = new Blob([result.value.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.value;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return {
    format,
    info,
    complete,
    stubs,
    baseUrl,
    appPackage,
    range,
    length,
    reset,
    recordsSteps,
    hasBodies,
    actions,
    result,
    fileName,
    download,
  };
}
