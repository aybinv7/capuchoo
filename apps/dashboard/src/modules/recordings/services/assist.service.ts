import { http } from "@/shared/api/http";
import type { AssistStart } from "../types/assist.types";

/** Opens an assist session for a device; the device is asked within a second if its app is open. */
export const startAssist = (deviceUuid: string) =>
  http.post<AssistStart>(`/devices/${encodeURIComponent(deviceUuid)}/assist`);

export const endAssist = (sessionId: string) =>
  http.delete(`/assist/${encodeURIComponent(sessionId)}`);
