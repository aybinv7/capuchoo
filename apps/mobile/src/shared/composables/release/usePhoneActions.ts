import { can } from "@/shared/access/capabilities";
import type { AppRelease } from "@/shared/composables/release/useAppRelease";
import { useInstaller } from "@/shared/composables/release/useInstaller";
import { CapuchooDevice, hasDevice } from "@/shared/native/device";

/** What the phone card can do for the current app: install its channel's build, or open it. */
export function usePhoneActions(release: Ref<AppRelease | null>) {
  const { install, cancel, jobFor } = useInstaller();

  const canInstall = computed(() =>
    Boolean(release.value && can.install(release.value.app) && hasDevice()),
  );
  const job = computed(() =>
    release.value?.phone.target ? jobFor(release.value.phone.target.id) : undefined,
  );

  function installTarget(): void {
    const data = release.value;
    const target = data?.natives.find((build) => build.id === data.phone.target?.id);
    if (data && target)
      void install({
        app: data.app,
        build: target,
        identifiers: data.identifiers,
        installed: data.installed,
      });
  }

  function cancelTarget(): void {
    const target = release.value?.phone.target;
    if (target) void cancel(target.id);
  }

  async function openOnPhone(): Promise<void> {
    const bundleId = release.value?.phone.bundleId;
    if (bundleId && hasDevice()) await CapuchooDevice.open({ packageName: bundleId });
  }

  return { canInstall, job, installTarget, cancelTarget, openOnPhone };
}
