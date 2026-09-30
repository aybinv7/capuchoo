import {
  Gauge,
  History,
  Layers,
  ScrollText,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "@lucide/vue";

export interface Feature {
  title: string;
  /** Words set in the accent serif after the title. */
  accent: string;
  description: string;
  icon: LucideIcon;
  span: "wide" | "narrow";
  visual: "signature" | "gate" | "rollback" | "canvas" | "flavours" | "audit";
}

/** What the product does today; every line maps to code and a test in the repository. */
export const FEATURES: readonly Feature[] = [
  {
    title: "Signed",
    accent: "end to end",
    description:
      "The CLI signs bundles and APKs with your app's ECDSA key, and the server can refuse anything unsigned. Devices verify the signature and the SHA-256 before applying or installing.",
    icon: ShieldCheck,
    span: "wide",
    visual: "signature",
  },
  {
    title: "Native",
    accent: "gate",
    description:
      "A bundle only reaches builds that can run it. When it needs newer native code, the device is offered the APK first.",
    icon: Gauge,
    span: "narrow",
    visual: "gate",
  },
  {
    title: "Explicit",
    accent: "rollbacks",
    description:
      "Moving a channel to an older version is refused unless it is marked as a rollback, with the reason kept in the channel history.",
    icon: History,
    span: "narrow",
    visual: "rollback",
  },
  {
    title: "Live",
    accent: "canvas",
    description:
      "Builds, channels, adoption and failures stream into the dashboard as they happen. Drag a release onto a channel to deliver it.",
    icon: Workflow,
    span: "wide",
    visual: "canvas",
  },
  {
    title: "Strict",
    accent: "flavours",
    description:
      "Every artefact belongs to one flavour. A dev bundle cannot land on a prod channel, from the CLI or the dashboard.",
    icon: Layers,
    span: "narrow",
    visual: "flavours",
  },
  {
    title: "Audited",
    accent: "by default",
    description:
      "Every upload, delivery and pause is recorded with who did it and from which credential. Prod deliveries need the role you set.",
    icon: ScrollText,
    span: "wide",
    visual: "audit",
  },
];
