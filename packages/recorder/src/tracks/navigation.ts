type Push = (data: Record<string, unknown>) => void;

/**
 * Route changes as markers, from the History API. A router that keeps its own stack (Framework7
 * without browser history) should call `recorder.mark("route", { url })` itself.
 */
export function watchNavigation(push: Push): () => void {
  const emit = () =>
    push({ kind: "route", url: `${location.pathname}${location.search}${location.hash}` });
  const { pushState, replaceState } = history;

  history.pushState = function recordedPush(...args: Parameters<History["pushState"]>) {
    pushState.apply(history, args);
    emit();
  };
  history.replaceState = function recordedReplace(...args: Parameters<History["replaceState"]>) {
    replaceState.apply(history, args);
    emit();
  };
  window.addEventListener("popstate", emit);
  window.addEventListener("hashchange", emit);
  emit();

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.removeEventListener("popstate", emit);
    window.removeEventListener("hashchange", emit);
  };
}
