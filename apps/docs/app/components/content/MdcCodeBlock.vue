<script setup lang="ts">
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { codeToHtml } from "shiki";

const props = withDefaults(
  defineProps<{
    code: string;
    lang?: string;
    twoslash?: boolean;
    class?: string;
  }>(),
  {
    lang: "ts",
    twoslash: false,
    class: "",
  },
);

const html = await codeToHtml(props.code, {
  lang: props.lang,
  theme: {
    light: "vitesse-light",
    default: "vitesse-light",
    dark: "vitesse-dark",
  },
  transformers: props.twoslash
    ? [
        transformerTwoslash({
          explicitTrigger: false,
          throws: false,
        }),
      ]
    : [],
});
</script>

<template>
  <ClientOnly>
    <div :class="props.class" v-html="html" />

    <template #fallback>
      <div :class="props.class" v-html="html" />
    </template>
  </ClientOnly>
</template>
