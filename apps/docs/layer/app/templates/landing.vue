<script setup lang="ts">
import type { Collections } from "@nuxt/content";

const route = useRoute();
const { locale, isEnabled } = useDocusI18n();

// Dynamic collection name based on i18n status
const collectionName = computed(() => (isEnabled.value ? `landing_${locale.value}` : "landing"));
const pageKey = computed(() => `${collectionName.value}:${route.path}`);

const { data: page } = await useAsyncData(
  () => `landing:${pageKey.value}`,
  () =>
    queryCollection(collectionName.value as keyof Collections)
      .path(route.path)
      .first(),
  {
    watch: [collectionName, () => route.path],
  },
);
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: true });
}

const title = computed(() => page.value?.seo?.title || page.value?.title);
const description = computed(() => page.value?.seo?.description || page.value?.description);

useSeo({
  title,
  description,
  type: "website",
  ogImage: computed(() => page.value?.seo?.ogImage as string | undefined),
});

if (!page.value?.seo?.ogImage) {
  defineOgImageComponent("Landing", {
    title,
    description,
  });
}
</script>

<template>
  <ContentRenderer v-if="page" :value="page" />
</template>
