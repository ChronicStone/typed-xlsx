<script setup lang="ts">
/**
 * Client-only code block with Twoslash hover popups powered by floating-vue.
 *
 * HTML is pre-computed at build time by `scripts/generate-twoslash-html.mjs`
 * and served as static assets. This component fetches the HTML and uses Vue's
 * runtime compiler (enabled via `vue.runtimeCompiler: true` in nuxt.config)
 * to compile `<v-menu>` elements from the Twoslash output into real
 * floating-vue popups.
 *
 * Must be wrapped in `<ClientOnly>` — runtime compilation only runs in the
 * browser.
 */

const props = withDefaults(
  defineProps<{
    /** Artifact ID (e.g. "deal-desk-quote-review") */
    artifactId: string;
    /** Source pane key (e.g. "schema.ts") */
    paneKey: string;
    /** Optional CSS class to add to the outer wrapper */
    class?: string;
    /** Theme name — determines which pre-computed HTML file to load */
    theme?: "vitesse-dark" | "vitesse-light";
  }>(),
  {
    class: "",
    theme: "vitesse-dark",
  },
);

const cache = new Map<string, string>();

function buildUrl(artifactId: string, paneKey: string, theme: string) {
  return `/generated/examples/showcase/${artifactId}/twoslash/${theme}/${paneKey}.html`;
}

const html = ref("");
const loading = ref(true);
let version = 0;

async function update() {
  const v = ++version;
  const url = buildUrl(props.artifactId, props.paneKey, props.theme);

  const cached = cache.get(url);
  if (cached) {
    html.value = cached;
    loading.value = false;
    return;
  }

  try {
    const result = await $fetch<string>(url);
    if (v === version) {
      cache.set(url, result);
      html.value = result;
      loading.value = false;
    }
  } catch (err) {
    console.error("[PlaygroundCodeBlock] Failed to load pre-computed HTML", err);
    if (v === version) {
      loading.value = false;
    }
  }
}

// Kick off first load on mount (no top-level await = no Suspense needed)
onMounted(update);

// Re-load when props change (e.g. switching panes or theme)
watch(
  () => [props.artifactId, props.paneKey, props.theme] as const,
  () => {
    loading.value = true;
    update();
  },
);

// Dynamic component compiled from the Twoslash HTML at runtime.
// The HTML contains `<v-menu>` elements that Vue's runtime compiler
// turns into real floating-vue popups.
const DynamicBlock = computed(() => {
  if (!html.value) return null;
  return defineComponent({
    template: `<div class="${props.class}">${html.value}</div>`,
  });
});
</script>

<template>
  <div v-if="loading" class="flex h-full items-center justify-center py-20">
    <div class="flex flex-col items-center gap-3">
      <div class="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <p class="text-xs text-toned">Loading code…</p>
    </div>
  </div>
  <component :is="DynamicBlock" v-else-if="DynamicBlock" />
</template>
