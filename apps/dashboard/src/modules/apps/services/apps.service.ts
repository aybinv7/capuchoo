import { http } from "@/shared/api/http";
import type { AppSummary, SessionOrganization } from "@/shared/types/session";

export interface CreateAppInput {
  organization_id: string;
  app_id: string;
  name: string;
  platform: "all" | "android" | "ios";
}

export const createApp = (input: CreateAppInput) =>
  http.post<AppSummary & { adopted?: boolean }>("/apps", input);

export const createOrganization = (name: string) =>
  http.post<SessionOrganization>("/organizations", { name });
