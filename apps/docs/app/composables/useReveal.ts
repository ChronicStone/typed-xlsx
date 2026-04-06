import type { Ref } from "vue";

/**
 * Enables scroll reveal only for sections that start below the current viewport.
 * Content already visible on load stays visible to avoid hydration/refresh delay.
 */
export function useReveal(rootRef: Ref<HTMLElement | null>) {
  if (import.meta.server) return;

  let observer: IntersectionObserver | undefined;
  const cleanupTimers = new Map<Element, ReturnType<typeof setTimeout>>();

  const markRevealComplete = (el: Element) => {
    const existingTimer = cleanupTimers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    const styles = window.getComputedStyle(el);
    const staggerDelay = Number.parseFloat(styles.getPropertyValue("--reveal-stagger-delay")) || 0;
    const staggerStep = Number.parseFloat(styles.getPropertyValue("--reveal-stagger-step")) || 70;
    const staggerDuration =
      Number.parseFloat(styles.getPropertyValue("--reveal-stagger-duration")) || 500;
    const childCount = el.children.length;
    const totalDelay =
      childCount > 0 ? staggerDelay + Math.max(childCount - 1, 0) * staggerStep : 0;
    const totalDuration = styles.getPropertyValue("--reveal-stagger-duration")
      ? totalDelay + staggerDuration
      : (Number.parseFloat(styles.getPropertyValue("--reveal-duration")) || 700) +
        (Number.parseFloat(styles.getPropertyValue("--reveal-delay")) || 0);

    const timer = setTimeout(() => {
      el.classList.add("reveal-complete");
      cleanupTimers.delete(el);
    }, totalDuration + 40);

    cleanupTimers.set(el, timer);
  };

  const isNearViewport = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    return rect.top <= viewportHeight + 120 && rect.bottom >= -80;
  };

  onMounted(() => {
    const root = rootRef.value;
    if (!root) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            markRevealComplete(entry.target);
            observer!.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" },
    );

    root.classList.add("motion-ready");

    root.querySelectorAll<Element>(".reveal, .reveal-stagger").forEach((el) => {
      if (isNearViewport(el)) {
        el.classList.add("in-view", "reveal-complete");
        markRevealComplete(el);
        return;
      }

      el.classList.add("reveal-pending");

      observer!.observe(el);
    });
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    cleanupTimers.forEach((timer) => clearTimeout(timer));
  });
}
