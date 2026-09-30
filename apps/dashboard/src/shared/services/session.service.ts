import { http } from "../api/http";
import type { Me } from "../types/session";

export const fetchMe = (signal?: AbortSignal) => http.get<Me>("/auth/me", undefined, signal);

export const logout = () => http.post<{ ok: true }>("/auth/logout");
