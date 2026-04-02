<script setup lang="ts">
import { codeToHtml } from "shiki";

const props = withDefaults(
  defineProps<{
    code: string;
    lang?: string;
    twoslash?: boolean;
    class?: string;
    theme?: "vitesse-dark" | "vitesse-light";
  }>(),
  {
    lang: "ts",
    twoslash: false,
    class: "",
    theme: undefined,
  },
);

function hashCodeBlock(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

async function renderCodeToHtml() {
  const transformers = [];

  if (props.twoslash && import.meta.server) {
    const { transformerTwoslash } = await import("@shikijs/twoslash");

    transformers.push(
      transformerTwoslash({
        explicitTrigger: false,
        throws: false,
      }),
    );
  }

  return codeToHtml(props.code, {
    lang: props.lang,
    theme: props.theme
      ? props.theme
      : {
          light: "vitesse-light",
          default: "vitesse-light",
          dark: "vitesse-dark",
        },
    transformers,
  });
}

const cacheKey = computed(
  () =>
    `mdc-code-block:${props.lang}:${props.twoslash ? "twoslash" : "plain"}:${props.theme ?? "auto"}:${hashCodeBlock(props.code)}`,
);

const htmlCache = useState<Record<string, string>>("mdc-code-block-cache", () => ({}));
const html = ref("");
let renderVersion = 0;

async function ensureHtml(key: string) {
  try {
    if (!htmlCache.value[key]) {
      htmlCache.value[key] = await renderCodeToHtml();
    }

    return htmlCache.value[key] ?? "";
  } catch (error) {
    console.error("Failed to render code block", error);
    return "";
  }
}

html.value = await ensureHtml(cacheKey.value);

watch(cacheKey, async (key) => {
  const currentVersion = ++renderVersion;
  const nextHtml = await ensureHtml(key);

  if (currentVersion === renderVersion) {
    html.value = nextHtml;
  }
});

// ── Twoslash popup teleport ──────────────────────────────────────────
// rendererRich outputs .twoslash-popup-container as position:absolute inside
// .twoslash-hover (position:relative). Any overflow:hidden/auto ancestor clips
// the popup. We teleport it to document.body with position:fixed on hover so it
// renders freely above everything.

const root = ref<HTMLElement | null>(null);

function useTwoslashTeleport() {
  if (!props.twoslash) return;

  let activePopup: HTMLElement | null = null;
  let activeToken: HTMLElement | null = null;
  let isOverPopup = false;
  let isOverToken = false;

  function position(token: HTMLElement, popup: HTMLElement) {
    const rect = token.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.transform = "none";
    popup.style.opacity = "1";
    popup.style.pointerEvents = "auto";
    popup.style.zIndex = "10000";

    // Clamp to viewport on next frame once layout is computed
    requestAnimationFrame(() => {
      if (popup !== activePopup) return;
      const pr = popup.getBoundingClientRect();

      if (pr.right > window.innerWidth - 16) {
        popup.style.left = `${Math.max(16, window.innerWidth - pr.width - 16)}px`;
      }

      if (pr.bottom > window.innerHeight - 16) {
        popup.style.top = `${rect.top - pr.height - 4}px`;
      }
    });
  }

  function show(token: HTMLElement) {
    const popup = token.querySelector<HTMLElement>(":scope > .twoslash-popup-container");
    if (!popup) return;
    if (activeToken === token) return; // already showing this one

    hide();
    activeToken = token;
    activePopup = popup;
    isOverToken = true;
    isOverPopup = false;

    // Teleport to body
    document.body.appendChild(popup);
    position(token, popup);

    // Listen for pointer entering / leaving the teleported popup
    popup.addEventListener("pointerenter", onPopupEnter);
    popup.addEventListener("pointerleave", onPopupLeave);
  }

  function hide() {
    if (activePopup && activeToken) {
      activePopup.removeEventListener("pointerenter", onPopupEnter);
      activePopup.removeEventListener("pointerleave", onPopupLeave);

      // Reset inline styles and return to original parent
      activePopup.style.position = "";
      activePopup.style.left = "";
      activePopup.style.top = "";
      activePopup.style.transform = "";
      activePopup.style.opacity = "";
      activePopup.style.pointerEvents = "";
      activePopup.style.zIndex = "";
      activeToken.appendChild(activePopup);
    }

    activePopup = null;
    activeToken = null;
    isOverPopup = false;
    isOverToken = false;
  }

  function tryHide() {
    // Only hide when pointer is on neither the token nor the popup
    if (!isOverToken && !isOverPopup) hide();
  }

  // ── Event handlers ──

  function onTokenEnter(e: PointerEvent) {
    const token = (e.target as HTMLElement).closest?.(".twoslash-hover") as HTMLElement | null;
    if (!token || !root.value?.contains(token)) return;
    isOverToken = true;
    show(token);
  }

  function onTokenLeave(e: PointerEvent) {
    const token = (e.target as HTMLElement).closest?.(".twoslash-hover") as HTMLElement | null;
    if (!token || token !== activeToken) return;
    isOverToken = false;
    // Defer so that pointerenter on the popup can fire first
    requestAnimationFrame(tryHide);
  }

  function onPopupEnter() {
    isOverPopup = true;
  }

  function onPopupLeave() {
    isOverPopup = false;
    requestAnimationFrame(tryHide);
  }

  onMounted(() => {
    const el = root.value;
    if (!el) return;

    el.addEventListener("pointerover", onTokenEnter);
    el.addEventListener("pointerout", onTokenLeave);
  });

  onBeforeUnmount(() => {
    hide();
    const el = root.value;
    if (!el) return;

    el.removeEventListener("pointerover", onTokenEnter);
    el.removeEventListener("pointerout", onTokenLeave);
  });
}

useTwoslashTeleport();
</script>

<template>
  <div ref="root" :class="props.class" v-html="html" />
</template>
