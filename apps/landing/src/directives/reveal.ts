import type { Directive } from "vue";

let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof IntersectionObserver === "undefined") return null;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.dataset.reveal = "shown";
        observer?.unobserve(element);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );
  return observer;
}

/**
 * Fades an element in the first time it scrolls into view. One observer serves the whole page;
 * without IntersectionObserver the element is simply left visible. The value is a delay in ms.
 */
export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(element, binding) {
    const io = shared();
    if (!io) return;
    if (binding.value) element.style.setProperty("--reveal-delay", `${binding.value}ms`);
    element.dataset.reveal = "pending";
    io.observe(element);
  },
  unmounted(element) {
    observer?.unobserve(element);
  },
};
