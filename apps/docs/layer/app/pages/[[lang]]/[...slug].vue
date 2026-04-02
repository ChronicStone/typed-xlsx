<script setup lang="ts">
import { kebabCase } from "scule";
import type { ContentNavigationItem, Collections, DocsCollectionItem } from "@nuxt/content";
import { findPageHeadline } from "@nuxt/content/utils";

definePageMeta({
  layout: "docs",
});

const route = useRoute();
const { locale, isEnabled, t } = useDocusI18n();
const appConfig = useAppConfig();
const navigation = inject<Ref<ContentNavigationItem[]>>("navigation");

const collectionName = computed(() => (isEnabled.value ? `docs_${locale.value}` : "docs"));
const pageKey = computed(() => `${collectionName.value}:${route.path}`);

const [{ data: page }, { data: surround }] = await Promise.all([
  useAsyncData(
    () => `page:${pageKey.value}`,
    () =>
      queryCollection(collectionName.value as keyof Collections)
        .path(route.path)
        .first() as Promise<DocsCollectionItem>,
    {
      watch: [collectionName, () => route.path],
    },
  ),
  useAsyncData(
    () => `surround:${pageKey.value}`,
    () => {
      return queryCollectionItemSurroundings(
        collectionName.value as keyof Collections,
        route.path,
        {
          fields: ["description"],
        },
      );
    },
    {
      watch: [collectionName, () => route.path],
    },
  ),
]);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: true });
}

const title = computed(() => page.value?.seo?.title || page.value?.title);
const description = computed(() => page.value?.seo?.description || page.value?.description);

const headline = ref(findPageHeadline(navigation?.value, page.value?.path));
const breadcrumbs = computed(() => findPageBreadcrumbs(navigation?.value, page.value?.path || ""));

useSeo({
  title,
  description,
  type: "article",
  modifiedAt: (page.value as unknown as Record<string, unknown>).modifiedAt as string | undefined,
  breadcrumbs,
});
watch(
  () => navigation?.value,
  () => {
    headline.value = findPageHeadline(navigation?.value, page.value?.path) || headline.value;
  },
);

defineOgImageComponent("Docs", {
  headline,
});

const github = computed(() => (appConfig.github ? appConfig.github : null));

const editLink = computed(() => {
  if (!github.value) {
    return;
  }

  return [
    github.value.url,
    "edit",
    github.value.branch,
    github.value.rootDir,
    "content",
    `${page.value?.stem}.${page.value?.extension}`,
  ]
    .filter(Boolean)
    .join("/");
});

// Add the page path to the prerender list
addPrerenderPath(`/raw${route.path}.md`);
</script>

<template>
  <UPage v-if="page" :key="`page-${route.path}`">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :headline="headline"
      :ui="{
        wrapper: 'flex-row items-center flex-wrap justify-between',
      }"
    >
      <template #links>
        <UButton
          v-for="(link, index) in (page as DocsCollectionItem).links"
          :key="index"
          size="sm"
          v-bind="link"
        />

        <DocsPageHeaderLinks />
      </template>
    </UPageHeader>

    <UPageBody>
      <ContentRenderer v-if="page" :value="page" />

      <USeparator v-if="github">
        <div class="flex items-center gap-2 text-sm text-muted">
          <UButton
            variant="link"
            color="neutral"
            :to="editLink"
            target="_blank"
            icon="i-lucide-pen"
            :ui="{ leadingIcon: 'size-4' }"
          >
            {{ t("docs.edit") }}
          </UButton>
          <span>{{ t("common.or") }}</span>
          <UButton
            variant="link"
            color="neutral"
            :to="`${github.url}/issues/new/choose`"
            target="_blank"
            icon="i-lucide-alert-circle"
            :ui="{ leadingIcon: 'size-4' }"
          >
            {{ t("docs.report") }}
          </UButton>
        </div>
      </USeparator>
      <UContentSurround :surround="surround" />
    </UPageBody>

    <template #right>
      <DocsAsideRight :page="page" />
    </template>
  </UPage>
</template>
