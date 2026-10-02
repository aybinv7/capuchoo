import { http } from "@/shared/api/http";
import type { DemoSeed, DemoStatus } from "../types/settings.types";

export const fetchDemo = (signal?: AbortSignal) =>
  http.get<DemoStatus>("/admin/demo", undefined, signal);

/** Replaces the demo organization; the server takes 10-30 s to build it. */
export const seedDemo = () => http.post<DemoSeed>("/admin/demo");
