<script setup lang="ts">
import type { ContentNavigationItem, PageCollections } from "@nuxt/content";
import * as nuxtUiLocales from "@nuxt/ui/locale";
import { useSubNavigation } from "../layer/app/composables/useSubNavigation";
import { transformNavigation } from "../layer/app/utils/navigation";

const appConfig = useAppConfig();
const { seo } = appConfig;
const site = useSiteConfig();
const { locale, locales, isEnabled, switchLocalePath } = useDocusI18n();

const nuxtUiLocale = computed(
  () => nuxtUiLocales[locale.value as keyof typeof nuxtUiLocales] || nuxtUiLocales.en,
);
const lang = computed(() => nuxtUiLocale.value.code);
const dir = computed(() => nuxtUiLocale.value.dir);
const collectionName = computed(() => (isEnabled.value ? `docs_${locale.value}` : "docs"));
const faviconHref = computed(() => appConfig.header?.logo?.favicon || "/favicon.svg");

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: faviconHref }],
  htmlAttrs: {
    lang,
    dir,
  },
});

useSeoMeta({
  titleTemplate: seo.titleTemplate,
  title: seo.title,
  description: seo.description,
  ogSiteName: site.name,
  twitterCard: "summary_large_image",
});

if (isEnabled.value) {
  const route = useRoute();
  const defaultLocale = useRuntimeConfig().public.i18n.defaultLocale!;

  onMounted(() => {
    const currentLocale = route.path.split("/")[1];

    if (!locales.some((item) => item.code === currentLocale)) {
      return navigateTo(switchLocalePath(defaultLocale) as string);
    }
  });
}

const { data: navigation } = await useAsyncData(
  () => `navigation_${collectionName.value}`,
  () => queryCollectionNavigation(collectionName.value as keyof PageCollections),
  {
    transform: (data: ContentNavigationItem[]) =>
      transformNavigation(data, isEnabled.value, locale.value),
    watch: [locale],
  },
);

const { data: files } = useLazyAsyncData(
  `search_${collectionName.value}`,
  () => queryCollectionSearchSections(collectionName.value as keyof PageCollections),
  {
    server: false,
    watch: [locale],
  },
);

provide("navigation", navigation);

const { subNavigationMode } = useSubNavigation(navigation);
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <NuxtLoadingIndicator color="var(--ui-primary)" />

    <div
      :class="[
        'transition-[margin-right] duration-200 ease-linear will-change-[margin-right]',
        { 'docus-sub-header': subNavigationMode === 'header' },
      ]"
      :style="{ marginRight: '0' }"
    >
      <AppHeader v-if="$route.meta.header !== false" />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <AppFooter v-if="$route.meta.footer !== false" />
    </div>

    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" />
    </ClientOnly>
  </UApp>
</template>

<style>
@media (min-width: 1024px) {
  .docus-sub-header {
    --ui-header-height: 112px;
  }
}

.dot-grid {
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  background-size: 32px 32px;
}

.dark .dot-grid {
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
}

.landing-card {
  display: block;
  border-radius: 1.5rem;
  border: 1px solid color-mix(in oklab, var(--ui-border) 92%, transparent);
  background: color-mix(in oklab, var(--ui-bg) 92%, white 8%);
  padding: 1.25rem;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.landing-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklab, var(--ui-primary) 40%, var(--ui-border) 60%);
  background: color-mix(in oklab, var(--ui-bg) 88%, white 12%);
}

.landing-card h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.landing-card p {
  margin: 0.65rem 0 0;
  line-height: 1.6;
  color: var(--ui-text-toned);
}

.landing-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--ui-primary) 22%, var(--ui-border) 78%);
  background: color-mix(in oklab, var(--ui-primary) 7%, var(--ui-bg) 93%);
  padding: 0.24rem 0.55rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--ui-primary) 75%, var(--ui-text) 25%);
}

.landing-hero-title {
  margin: 0;
  font-size: clamp(3rem, 6vw, 3.875rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: var(--ui-text-highlighted);
}

.landing-code-panel :deep(pre) {
  margin-top: 0;
  width: 100%;
}

.landing-code-panel {
  width: 100%;
}

.landing-code-panel :deep(.relative.group) {
  width: 100%;
}

.landing-code-panel :deep(.group.font-mono),
.landing-code-panel :deep(.vp-code-group) {
  width: 100%;
  margin-inline: 0;
}

.landing-two-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.landing-two-col > * {
  min-width: 0;
}

.landing-pipeline-card {
  border-radius: 1.75rem;
  border: 1px solid color-mix(in oklab, var(--ui-border) 92%, transparent);
  background: color-mix(in oklab, var(--ui-bg) 94%, white 6%);
  padding: 1.5rem;
  box-shadow: 0 24px 60px -50px rgba(0, 0, 0, 0.28);
}

.landing-pipeline-item {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.landing-pipeline-item::after {
  content: "";
  position: absolute;
  left: 0.95rem;
  top: 2.4rem;
  bottom: 0;
  width: 1px;
  background: color-mix(in oklab, var(--ui-border) 82%, transparent);
}

.landing-pipeline-item.is-last {
  padding-bottom: 0;
}

.landing-pipeline-item.is-last::after {
  display: none;
}

.landing-pipeline-icon {
  display: flex;
  height: 2rem;
  width: 2rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  background: color-mix(in oklab, var(--ui-primary) 10%, var(--ui-bg) 90%);
  color: var(--ui-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

.landing-pipeline-copy {
  padding-top: 0.1rem;
}

.landing-pipeline-label {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.landing-pipeline-desc {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--ui-text-toned);
}

.landing-cta {
  margin: 0 auto;
  max-width: 42rem;
  border-radius: 1.75rem;
  border: 1px solid color-mix(in oklab, var(--ui-primary) 18%, transparent);
  background: color-mix(in oklab, var(--ui-primary) 6%, var(--ui-bg) 94%);
  padding: 3rem;
  text-align: center;
}

.landing-cta [data-slot="body"] {
  padding: 0;
}

.dark .landing-cta {
  border-color: color-mix(in oklab, var(--ui-primary) 18%, transparent);
  background: color-mix(in oklab, var(--ui-primary) 6%, var(--ui-bg) 94%);
}

.typed-xlsx-feature-grid [data-slot="root"] {
  min-height: 100%;
}

.typed-xlsx-live-card [data-slot="body"] {
  padding: 0;
}

.landing-section-pad {
  max-width: 80rem;
  margin-inline: auto;
  padding-inline: 1rem;
}

:root {
  --vp-c-bg: var(--ui-bg);
  --vp-c-text-1: var(--ui-text-highlighted);
  --vp-c-text-2: var(--ui-text-toned);
  --vp-c-text-3: color-mix(in oklab, var(--ui-text-toned) 76%, transparent);
  --vp-c-border: color-mix(in oklab, var(--ui-border) 72%, transparent);
  --vp-c-brand: var(--ui-primary);
  --vp-font-family-base: inherit;
  --vp-font-family-mono:
    ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace;
  --vp-code-font-size: 0.85rem;
  --vp-code-line-height: 1.6;
  --vp-code-block-bg: color-mix(in oklab, var(--ui-bg) 97%, white 3%);
  --vp-code-block-color: var(--ui-text-highlighted);
  --vp-code-tab-bg: var(--vp-code-block-bg);
  --vp-code-tab-text-color: var(--ui-text-toned);
  --vp-code-tab-active-text-color: var(--ui-text-highlighted);
  --vp-code-tab-hover-text-color: var(--ui-text-highlighted);
  --vp-code-copy-code-bg: var(--vp-code-block-bg);
  --vp-code-copy-code-hover-bg: var(--vp-code-block-bg);
  --twoslash-popup-bg: color-mix(in oklab, var(--ui-bg) 96%, white 4%);
  --twoslash-popup-color: var(--ui-text-highlighted);
  --twoslash-border-color: color-mix(in oklab, var(--ui-border) 72%, transparent);
  --twoslash-docs-color: var(--ui-text-toned);
  --twoslash-underline-color: color-mix(in oklab, var(--ui-primary) 55%, transparent);
  --twoslash-cursor-color: var(--ui-primary);
  --twoslash-matched-color: var(--ui-primary);
  --twoslash-unmatched-color: var(--ui-text-toned);
  --twoslash-popup-shadow: 0 18px 48px -24px rgb(0 0 0 / 0.3), 0 6px 18px -10px rgb(0 0 0 / 0.18);
}

.dark {
  --vp-code-block-bg: color-mix(in oklab, var(--ui-bg) 90%, white 10%);
  --twoslash-popup-bg: color-mix(in oklab, var(--ui-bg) 94%, white 6%);
  --twoslash-popup-shadow: 0 20px 56px -28px rgb(0 0 0 / 0.55), 0 8px 24px -12px rgb(0 0 0 / 0.3);
}

.v-popper--theme-twoslash .v-popper__inner {
  border: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent) !important;
  border-radius: 0.75rem !important;
  background: color-mix(in oklab, var(--ui-bg) 94%, black 6%) !important;
  box-shadow:
    0 20px 48px -26px rgb(0 0 0 / 0.42),
    0 6px 16px -10px rgb(0 0 0 / 0.24) !important;
  color: var(--ui-text-highlighted) !important;
  padding: 0.875rem !important;
  max-height: min(70vh, 34rem) !important;
  overflow: auto !important;
  overscroll-behavior: contain !important;
}

.v-popper--theme-twoslash .v-popper__wrapper,
.v-popper--theme-twoslash .v-popper__backdrop {
  background: transparent !important;
}

.v-popper--theme-twoslash .v-popper__wrapper {
  overflow: visible !important;
}

.v-popper--theme-twoslash .twoslash-popup-container {
  display: block !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* Strip Nuxt UI code chrome from the intermediate wrapper */
.v-popper--theme-twoslash .twoslash-popup-code {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  display: block !important;
}

.v-popper--theme-twoslash .twoslash-popup-code > .relative,
.v-popper--theme-twoslash .twoslash-popup-code > .group,
.v-popper--theme-twoslash .twoslash-popup-code > .vp-code,
.v-popper--theme-twoslash .twoslash-popup-code > .vp-code-group {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.v-popper--theme-twoslash .twoslash-popup-code button {
  display: none !important;
}

.v-popper--theme-twoslash .twoslash-popup-code pre.shiki,
.v-popper--theme-twoslash .twoslash-popup-code pre[class*="shiki"] {
  margin: 0 !important;
  min-width: 0 !important;
  width: auto !important;
  max-width: min(40rem, calc(100vw - 5rem)) !important;
  overflow-x: auto !important;
  border: 1px solid color-mix(in oklab, var(--ui-border) 64%, transparent) !important;
  border-radius: 0.7rem !important;
  background: var(--vp-code-block-bg) !important;
  box-shadow: none !important;
  padding: 1rem !important;
}

.v-popper--theme-twoslash .twoslash-popup-code pre.shiki > code,
.v-popper--theme-twoslash .twoslash-popup-code pre[class*="shiki"] > code {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  line-height: 1.65 !important;
  padding-bottom: 0.08rem !important;
}

.v-popper--theme-twoslash .twoslash-popup-code pre.shiki .line,
.v-popper--theme-twoslash .twoslash-popup-code pre[class*="shiki"] .line,
.v-popper--theme-twoslash .twoslash-popup-code pre.shiki span,
.v-popper--theme-twoslash .twoslash-popup-code pre[class*="shiki"] span {
  background: transparent !important;
}

.v-popper--theme-twoslash .twoslash-popup-code code:not(pre code) {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* Fix arrow colors to match popup in both light/dark */
.v-popper--theme-twoslash .v-popper__arrow-outer {
  border-top-color: color-mix(in oklab, var(--ui-border) 70%, transparent) !important;
}

.v-popper--theme-twoslash .v-popper__arrow-inner {
  border-top-color: var(--ui-bg) !important;
}

/* Hide the redundant custom arrow inside the popup container */
.twoslash-popup-arrow {
  display: none !important;
}

.twoslash-floating {
  max-width: 36rem !important;
}

.twoslash-floating .twoslash-popup-docs,
.twoslash-floating .twoslash-popup-error,
.twoslash-floating .twoslash-popup-code {
  font-size: 0.82rem !important;
  line-height: 1.55 !important;
}

.twoslash-floating .twoslash-popup-docs {
  color: var(--ui-text-toned) !important;
  margin-top: 0.75rem !important;
  padding: 0.75rem 0 0.3rem !important;
  border-top: 1px solid color-mix(in oklab, var(--ui-border) 50%, transparent) !important;
}

.twoslash .twoslash-hover {
  border-bottom-color: color-mix(in oklab, var(--ui-primary) 55%, transparent) !important;
}

@media (max-width: 767px) {
  .landing-code-panel,
  .landing-pipeline-card,
  .landing-cta {
    margin-inline: 0.25rem;
  }

  .landing-page .grid {
    padding-inline: 0.25rem;
  }

  .landing-cta {
    padding: 2rem 1.5rem;
  }
}

@media (min-width: 640px) {
  .landing-section-pad {
    padding-inline: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .landing-section-pad {
    padding-inline: 2rem;
  }
}

@media (min-width: 1024px) {
  .landing-two-col {
    display: grid;
    grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.08fr);
    align-items: center;
    column-gap: 2rem;
  }

  .landing-two-col--hero {
    column-gap: 2.5rem;
  }
}
</style>
