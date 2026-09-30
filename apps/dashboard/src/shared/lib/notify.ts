import { toast } from "vue-sonner";
import { errorMessage, errorTitle } from "../api/errors";

/** A refusal or failure as a toast, titled by the server's reason. */
export function notifyError(error: unknown): void {
  toast.error(errorTitle(error), { description: errorMessage(error) });
}
