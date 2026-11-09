import { onBeforeUnmount, onMounted, type Ref } from "vue";

/** Shared helpers for the blueprint landing and playground widgets. */

export const esc = (value: unknown) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Tiny TypeScript highlighter for short snippets rendered on dark code panels. */
export function hl(src: string) {
  return esc(src).replace(
    /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|type|export|await|for|of|return|import|from|true|false)\b|\b(\d[\d_.]*)\b|([A-Za-z_$][\w$]*)(?=\??\s*:(?!:))|\.([A-Za-z_$][\w$]*)(?=\()|\b([A-Za-z_$][\w$]*)(?=\()/gm,
    (match, com, str, kw, num, key, meth, fn) => {
      if (com) return `<span class="t-com">${com}</span>`;
      if (str) return `<span class="t-str">${str}</span>`;
      if (kw) return `<span class="t-kw">${kw}</span>`;
      if (num) return `<span class="t-num">${num}</span>`;
      if (key) return `<span class="t-key">${key}</span>`;
      if (meth) return `.<span class="t-fn">${meth}</span>`;
      if (fn) return `<span class="t-fn">${fn}</span>`;
      return match;
    },
  );
}

/** XML highlighter for OOXML snippets. */
export function hlx(src: string) {
  return esc(src).replace(
    /(&lt;\/?)([\w:]+)|([\w:]+)(=)("[^"]*")/g,
    (_match, open, tag, attr, eq, val) => {
      if (open) return `${open}<span class="t-tag">${tag}</span>`;
      return `<span class="t-attr">${attr}</span>${eq}<span class="t-str">${val}</span>`;
    },
  );
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function spark(points: number[], w = 54, h = 15, color?: string) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xy = points.map((v, i) => [
    i * (w / (points.length - 1)),
    h - ((v - min) / (max - min || 1)) * (h - 2) - 1,
  ]);
  const last = xy[xy.length - 1]!;
  const style = color ? ` style="--c-spark:${color}"` : "";
  return `<svg class="spark"${style} viewBox="0 0 ${w} ${h}"><polyline points="${xy.map((p) => p.join(",")).join(" ")}"/><circle cx="${last[0]}" cy="${last[1]}" r="1.8"/></svg>`;
}

/** Lucide paths for icons that live inside generated cell markup. */
const ICON_PATHS: Record<string, string> = {
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "square-check": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
  square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  "arrow-left-right":
    '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
};

export function icon(name: keyof typeof ICON_PATHS | string, cls = "") {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] ?? ""}</svg>`;
}

export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A disposable scope for an imperative widget: every timer, frame loop, listener and observer
 * registered through it is released when the component unmounts (SPA navigation included).
 */
export function createScope(root: HTMLElement) {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const disposers: Array<() => void> = [];
  const frames: Array<(now: number) => void> = [];
  let rafId = 0;
  let dead = false;

  const tick = (now: number) => {
    if (dead) return;
    for (const frame of frames) frame(now);
    rafId = requestAnimationFrame(tick);
  };

  const scope = {
    root,
    $: <T extends Element = HTMLElement>(selector: string, base: ParentNode = root) =>
      base.querySelector(selector) as T,
    $$: <T extends Element = HTMLElement>(selector: string, base: ParentNode = root) =>
      [...base.querySelectorAll(selector)] as T[],
    get dead() {
      return dead;
    },
    timeout(fn: () => void, ms: number) {
      const id = setTimeout(() => {
        timeouts.delete(id);
        if (!dead) fn();
      }, ms);
      timeouts.add(id);
      return id;
    },
    clearTimeout(id: ReturnType<typeof setTimeout> | null | undefined) {
      if (id == null) return;
      clearTimeout(id);
      timeouts.delete(id);
    },
    interval(fn: () => void, ms: number) {
      const id = setInterval(() => !dead && fn(), ms);
      intervals.add(id);
      return id;
    },
    wait(ms: number) {
      return new Promise<void>((resolve) => scope.timeout(resolve, ms));
    },
    frame(fn: (now: number) => void) {
      frames.push(fn);
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    on<K extends string>(
      target: EventTarget,
      type: K,
      handler: (event: any) => void,
      options?: AddEventListenerOptions,
    ) {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    },
    track(dispose: () => void) {
      disposers.push(dispose);
    },
    observe(
      el: Element,
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      const io = new IntersectionObserver(callback, options);
      io.observe(el);
      disposers.push(() => io.disconnect());
      return io;
    },
    dispose() {
      dead = true;
      cancelAnimationFrame(rafId);
      timeouts.forEach((id) => clearTimeout(id));
      intervals.forEach((id) => clearInterval(id));
      disposers.forEach((fn) => fn());
    },
  };
  return scope;
}

export type WidgetScope = ReturnType<typeof createScope>;

export function useWidget(rootRef: Ref<HTMLElement | null>, setup: (scope: WidgetScope) => void) {
  let scope: WidgetScope | null = null;
  onMounted(() => {
    if (!rootRef.value) return;
    scope = createScope(rootRef.value);
    setup(scope);
  });
  onBeforeUnmount(() => scope?.dispose());
}

/** Fades `.reveal` children in as they enter the viewport. */
export function revealOnScroll(s: WidgetScope) {
  const els = s.$$(".reveal");
  if (prefersReducedMotion()) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
  s.track(() => io.disconnect());
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard can be blocked; the button still gives feedback */
  }
}
