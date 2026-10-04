export type ScreenId =
  | "overview"
  | "replay"
  | "errors"
  | "canvas"
  | "channels"
  | "channel-detail"
  | "releases"
  | "devices"
  | "statistics"
  | "builds"
  | "build-detail"
  | "palette"
  | "deliver";

export interface TourStop {
  id: ScreenId;
  label: string;
  path: string;
  title: string;
  description: string;
}

/** Screenshots of the real dashboard on the demo organization, in tour order. */
export const TOUR: readonly TourStop[] = [
  {
    id: "overview",
    label: "Overview",
    path: "app/overview",
    title: "How the app ships, and how it behaves",
    description:
      "Install success beside the errors devices hit, then what needs you first: an error that came back, a release that breaks more than the last, a channel failing installs.",
  },
  {
    id: "canvas",
    label: "Canvas",
    path: "release/canvas",
    title: "The whole release line at a glance",
    description:
      "Builds on the left, then dev, staging and prod, then each customer's channel. Live, so a running pipeline and a failed build show up as they happen.",
  },
  {
    id: "channels",
    label: "Channels",
    path: "release/channels",
    title: "Every pointer, with how its fleet is doing",
    description:
      "What each channel serves, how many devices already run it, and installs and failures over the last day. Deliver, roll back or pause from the row.",
  },
  {
    id: "channel-detail",
    label: "Channel",
    path: "channels/prod-contoso",
    title: "One channel's history, with who and why",
    description:
      "The bundle and native build it serves, their signatures and gates, and every move with its author and note.",
  },
  {
    id: "releases",
    label: "Releases",
    path: "release/releases",
    title: "Everything uploaded, and who serves it",
    description:
      "Search, filter by flavour or signature, see which channels serve each release, export what you need.",
  },
  {
    id: "replay",
    label: "Session replay",
    path: "session-replay/lenovo-tb-x606f",
    title: "The minutes before it broke",
    description:
      "The device's screen beside its taps, console, network and database writes, on one timeline. Jump from error to error, follow it live, or hand the session to Assist.",
  },
  {
    id: "errors",
    label: "Errors",
    path: "session-replay/errors",
    title: "Errors grouped, with the devices they reach",
    description:
      "Every uncaught error grouped across sessions and versions, how often it happened and on how many devices, with the replay one click away. A fixed error that returns is marked regressed.",
  },
  {
    id: "devices",
    label: "Devices",
    path: "fleet/devices",
    title: "The fleet, searched on the server",
    description:
      "Every installation with its versions and channel, filtered by channel or last check-in, paged from the server however large the fleet grows.",
  },
  {
    id: "statistics",
    label: "Statistics",
    path: "fleet/statistics",
    title: "Adoption and failures, per channel",
    description:
      "Installs and failures per day, update checks, running versions and each channel's health over the period you pick.",
  },
  {
    id: "builds",
    label: "Builds",
    path: "release/builds",
    title: "CLI and GitLab runs in one list",
    description:
      "Status, release, channel, branch and commit for every run, with the failing step and its message when one breaks.",
  },
];

export interface Clip {
  id: "deliver" | "palette";
  title: string;
  description: string;
}

export const CLIPS: readonly Clip[] = [
  {
    id: "deliver",
    title: "Deliver to one customer",
    description:
      "Only releases prod has served are offered. The summary shows what moves and how many devices it affects; production asks you to type the channel's name.",
  },
  {
    id: "palette",
    title: "Find anything in two keystrokes",
    description:
      "Ctrl K, then # for channels, @ for devices, > for actions. Pages, releases and builds too, newest first.",
  },
];

export const SCREEN_WIDTHS = [1280, 2400] as const;
