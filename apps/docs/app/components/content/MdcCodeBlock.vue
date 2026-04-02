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
    const { transformerTwoslash } = await import("@shikijs/vitepress-twoslash");

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
</script>

<template>
  <div :class="props.class" v-html="html" />
</template>
