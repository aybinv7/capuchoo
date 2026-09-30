import type { ConfigValueType } from "../types/settings.types";

export const CONFIG_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;

/** Why a value cannot be stored as its declared type, or null. The server stores the text as given. */
export function configValueProblem(value: string, type: ConfigValueType): string | null {
  if (type === "number" && (value.trim() === "" || !Number.isFinite(Number(value))))
    return "Not a number.";
  if (type === "boolean" && value !== "true" && value !== "false") return "Use true or false.";
  if (type === "json") {
    try {
      JSON.parse(value);
    } catch {
      return "Not valid JSON.";
    }
  }
  return null;
}
