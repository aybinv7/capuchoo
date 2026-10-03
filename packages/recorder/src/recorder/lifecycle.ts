interface NetworkInformationLike extends EventTarget {
  type?: string;
}

export interface LifecycleHandlers {
  onHidden: () => void;
  onNetwork: (online: boolean, wifi: boolean | null) => void;
}

function wifiState(): boolean | null {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection?.type) return null;
  return connection.type === "wifi" || connection.type === "ethernet";
}

/** The moments the recorder must act on: going to the background, and the network changing. */
export function watchLifecycle(handlers: LifecycleHandlers): () => void {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const network = () => handlers.onNetwork(navigator.onLine, wifiState());
  const visibility = () => {
    if (document.visibilityState === "hidden") handlers.onHidden();
  };

  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", handlers.onHidden);
  window.addEventListener("online", network);
  window.addEventListener("offline", network);
  connection?.addEventListener("change", network);
  network();

  return () => {
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", handlers.onHidden);
    window.removeEventListener("online", network);
    window.removeEventListener("offline", network);
    connection?.removeEventListener("change", network);
  };
}
