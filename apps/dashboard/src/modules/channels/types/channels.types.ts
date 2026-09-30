import type { Environment } from "@capuchoo/core";

export interface CreateChannelInput {
  app_id: string;
  name: string;
  kind: "release" | "client";
  environment?: Environment;
  base_channel_id?: string;
  public: boolean;
  allow_device_self_set: boolean;
}

/** Only the fields `PUT /api/channels/:id` accepts; pointers move through the delivery actions. */
export interface ChannelPatch {
  name?: string;
  environment?: Environment;
  public?: boolean;
  allow_dev?: boolean;
  allow_emulator?: boolean;
  ios_enabled?: boolean;
  android_enabled?: boolean;
  allow_device_self_set?: boolean;
}

export type ChannelFlag = Exclude<keyof ChannelPatch, "name" | "environment">;
