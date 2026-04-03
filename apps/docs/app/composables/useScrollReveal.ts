import { ref, onMounted, onUnmounted, type Ref } from "vue";

export interface ScrollRevealOptions {
  /** Fraction of element visible before triggering (0–1). Default 0.15 */
  threshold?: number;
  /** Extra rootMargin bottom offset. Default "0px" */
  rootMargin?: string;
  /** Once revealed, disconnect observer. Default true */
  once?: boolean;
}

/**
 * Composable that returns a template ref and a reactive `isVisible` flag.
 * Attach the ref to a wrapper element — when it scrolls into view the flag
 * flips to `true`, which you can bind to a CSS class for the entrance animation.
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", once = true } = options;

  const target = ref<HTMLElement | null>(null) as Ref<HTMLElement | null>;
  const isVisible = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (!target.value) return;

    // Respect reduced motion preference — reveal immediately
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      isVisible.value = true;
      return;
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          isVisible.value = true;
          if (once && observer && target.value) {
            observer.unobserve(target.value);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(target.value);
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return { target, isVisible };
}

/**
 * Create multiple scroll-reveal instances at once.
 * Returns an array of { target, isVisible } in the same order.
 */
export function useScrollRevealGroup(count: number, options: ScrollRevealOptions = {}) {
  return Array.from({ length: count }, () => useScrollReveal(options));
}
