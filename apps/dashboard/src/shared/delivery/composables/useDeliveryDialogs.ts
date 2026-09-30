import { reactive } from "vue";
import type { Channel } from "../../types/release";
import type { ArtefactKind } from "../lib/eligibility";

export type DeliveryDialog = "deliver" | "rollback" | "pause";

export interface DeliveryDialogState {
  active: DeliveryDialog | null;
  channel: Channel | null;
  artefactId: string | null;
  kind: ArtefactKind;
}

export type DeliveryDialogController = ReturnType<typeof useDeliveryDialogs>;

/** Which delivery dialog is open, for which channel. One host renders all three. */
export function useDeliveryDialogs() {
  const state = reactive<DeliveryDialogState>({
    active: null,
    channel: null,
    artefactId: null,
    kind: "ota",
  });

  function open(
    dialog: DeliveryDialog,
    channel: Channel,
    options: { artefactId?: string | null; kind?: ArtefactKind } = {},
  ) {
    state.channel = channel;
    state.artefactId = options.artefactId ?? null;
    state.kind = options.kind ?? "ota";
    state.active = dialog;
  }

  function setOpen(dialog: DeliveryDialog, value: boolean) {
    if (value) state.active = dialog;
    else if (state.active === dialog) state.active = null;
  }

  return {
    state,
    deliver: (channel: Channel, artefactId?: string | null) =>
      open("deliver", channel, { artefactId }),
    rollback: (channel: Channel, kind: ArtefactKind = "ota") => open("rollback", channel, { kind }),
    togglePause: (channel: Channel) => open("pause", channel),
    setOpen,
  };
}
