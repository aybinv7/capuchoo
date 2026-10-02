import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { installErrorMessage, manifestErrorMessage } from "../lib/github-messages";

const KEYS = ["github", "github_error", "app", "error"] as const;
type ReturnKey = (typeof KEYS)[number];

/**
 * Turns what GitHub's redirects append (github=linked, github_error, app=created, error) into
 * one toast, then removes them so a reload or a shared link does not repeat it. `onReturn` runs
 * after any return so the page can refetch what changed.
 */
export function useGithubReturnNotice(onReturn?: () => void) {
  const route = useRoute();
  const router = useRouter();

  onMounted(() => {
    const query = route.query;
    if (!KEYS.some((name) => name in query)) return;
    const value = (name: ReturnKey) => {
      const raw = query[name];
      return typeof raw === "string" ? raw : null;
    };

    if (value("github") === "linked") toast.success("GitHub installation linked");
    const installError = value("github_error");
    if (installError)
      toast.error("GitHub was not linked", { description: installErrorMessage(installError) });
    if (value("app") === "created") toast.success("GitHub App created");
    const manifestError = value("error");
    if (manifestError)
      toast.error("GitHub App not created", {
        description: manifestErrorMessage(manifestError),
      });

    onReturn?.();
    const rest = { ...query };
    for (const name of KEYS) delete rest[name];
    void router.replace({ query: rest });
  });
}
