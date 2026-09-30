import type { Build } from "@/shared/types/build";
import type { Bundle, Channel, NativeBuild } from "@/shared/types/release";
import type { ChannelStats } from "@/shared/types/stats";

export interface ChannelNodeData {
  channel: Channel;
  bundle: Bundle | null;
  native: NativeBuild | null;
  stats: ChannelStats | null;
}

export interface BuildNodeData {
  build: Build;
}

export interface LaneNodeData {
  label: string;
  hint: string;
}

export type CanvasNodeKind = "channel" | "build" | "lane";

export interface CanvasNode<T = ChannelNodeData | BuildNodeData | LaneNodeData> {
  id: string;
  type: CanvasNodeKind;
  position: { x: number; y: number };
  data: T;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: "smoothstep" | "default";
  animated?: boolean;
  label?: string;
  class?: string;
}
