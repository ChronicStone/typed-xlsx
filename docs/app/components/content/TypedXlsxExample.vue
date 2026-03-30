<script setup lang="ts">
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { codeToHtml } from "shiki";
// eslint-disable-next-line import/default
import dataSource from "../../../../packages/typed-xlsx/examples/financial-report-source/data.ts?raw";
// eslint-disable-next-line import/default
import fileSource from "../../../../packages/typed-xlsx/examples/financial-report-source/file.ts?raw";
// eslint-disable-next-line import/default
import schemaSource from "../../../../packages/typed-xlsx/examples/financial-report-source/schema.ts?raw";

const props = withDefaults(
  defineProps<{
    fileKey?: string;
  }>(),
  {
    fileKey: "financial-report",
  },
);

type PaneKey = "schema" | "data" | "file";
type RenderedPane = {
  key: PaneKey;
  label: `${PaneKey}.ts`;
  html: {
    static: {
      dark: string;
      light: string;
    };
    interactive: {
      dark: string;
      light: string;
    };
  };
};

const activePane = ref<PaneKey>("schema");
const split = ref(0.52);
const dragging = ref(false);
const container = ref<HTMLElement | null>(null);
const iframeFailed = ref(false);
const colorMode = useColorMode() as { value: string; forced?: string };
const hasMounted = ref(false);

const isDark = computed(() => colorMode.value === "dark");
const normalizedDataSource = dataSource.trim();
const normalizedSchemaSource = schemaSource
  .trim()
  .replaceAll("../../src", "@chronicstone/typed-xlsx");
const normalizedFileSource = fileSource.trim().replaceAll("../../src", "@chronicstone/typed-xlsx");

function buildPaneSource(target: PaneKey) {
  const fakerStub = `// @filename: node_modules/@faker-js/faker/index.d.ts
export const faker: any;`;

  if (target === "data") {
    return `${fakerStub}
// ---cut---
// @filename: data.ts
${normalizedDataSource}
`;
  }

  if (target === "schema") {
    return `${fakerStub}
// ---cut---
// @filename: data.ts
${normalizedDataSource}
// ---cut---
// @filename: schema.ts
${normalizedSchemaSource}
`;
  }

  return `${fakerStub}
// ---cut---
// @filename: data.ts
${normalizedDataSource}
// ---cut---
// @filename: schema.ts
${normalizedSchemaSource}
// ---cut---
// @filename: file.ts
${normalizedFileSource}
`;
}

async function buildHighlightedHtml(source: string, dark: boolean, interactive = false) {
  const html = await codeToHtml(source, {
    lang: "ts",
    theme: dark ? "github-dark" : "github-light",
    transformers: interactive
      ? [
          transformerTwoslash({
            explicitTrigger: false,
            throws: false,
          }),
        ]
      : [],
  });

  return html.replace(
    /<code><span class="line"><span[^>]*>\/\/ @filename: .*?<\/span><\/span>\s*/s,
    "<code>",
  );
}

const panes = useState<RenderedPane[]>("typed-xlsx-example-panes", () => []);

if (panes.value.length === 0) {
  panes.value = await Promise.all(
    (
      [
        { key: "schema", label: "schema.ts" },
        { key: "data", label: "data.ts" },
        { key: "file", label: "file.ts" },
      ] as const
    ).map(async ({ key, label }) => {
      const source = buildPaneSource(key);

      return {
        key,
        label,
        html: {
          static: {
            light: await buildHighlightedHtml(source, false),
            dark: await buildHighlightedHtml(source, true),
          },
          interactive: {
            light: await buildHighlightedHtml(source, false, true),
            dark: await buildHighlightedHtml(source, true, true),
          },
        },
      };
    }),
  );
}

const currentPane = computed(
  () => panes.value.find((pane) => pane.key === activePane.value) ?? panes.value[0],
);
const currentPaneStaticHtml = computed(() =>
  isDark.value ? currentPane.value.html.static.dark : currentPane.value.html.static.light,
);
const currentPaneInteractiveHtml = computed(() =>
  hasMounted.value && isDark.value
    ? currentPane.value.html.interactive.dark
    : currentPane.value.html.interactive.light,
);
const githubRawBase = "https://github.com/ChronicStone/typed-xlsx/raw/main/examples";
const workbookUrl = computed(() => `${githubRawBase}/${props.fileKey}.xlsx`);
const iframeUrl = computed(
  () =>
    `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(workbookUrl.value)}&action=embedview&wdHideGridlines=True&wdHideHeaders=True&wdAllowInteractivity=False`,
);
const splitStyle = computed(() => ({
  gridTemplateColumns: `${split.value}fr 12px ${1 - split.value}fr`,
}));

function stopDragging() {
  dragging.value = false;
  document.body.style.userSelect = "";
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", stopDragging);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || !container.value) return;
  const bounds = container.value.getBoundingClientRect();
  const ratio = (event.clientX - bounds.left) / bounds.width;
  split.value = Math.min(0.7, Math.max(0.3, ratio));
}

function startDragging() {
  dragging.value = true;
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", stopDragging);
}

onMounted(() => {
  hasMounted.value = true;
});

onBeforeUnmount(stopDragging);
</script>

<template>
  <div class="typed-xlsx-example">
    <UPageCard
      spotlight
      class="typed-xlsx-live-card overflow-hidden rounded-[1.75rem] border border-default/70 bg-default/90"
    >
      <div class="typed-xlsx-example__toolbar">
        <div>
          <p class="typed-xlsx-example__eyebrow">Live example</p>
          <h3 class="typed-xlsx-example__title">Financial report source + workbook preview</h3>
          <p class="typed-xlsx-example__copy">
            Browse the exact schema, data, and file builder source while previewing the generated
            workbook.
          </p>
        </div>

        <div class="typed-xlsx-example__actions">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-download"
            :to="workbookUrl"
            target="_blank"
          >
            Download workbook
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-simple-icons-github"
            to="https://github.com/ChronicStone/typed-xlsx/tree/main/examples/financial-report-source"
            target="_blank"
          >
            View source
          </UButton>
        </div>
      </div>
    </UPageCard>

    <div ref="container" class="typed-xlsx-example__split" :style="splitStyle">
      <section class="typed-xlsx-example__pane typed-xlsx-example__pane--code">
        <div class="typed-xlsx-example__tabs">
          <UButton
            v-for="pane in panes"
            :key="pane.key"
            :color="activePane === pane.key ? 'primary' : 'neutral'"
            :variant="activePane === pane.key ? 'soft' : 'ghost'"
            size="sm"
            @click="activePane = pane.key"
          >
            {{ pane.label }}
          </UButton>
        </div>

        <div class="typed-xlsx-example__code-wrap">
          <ClientOnly>
            <div class="typed-xlsx-example__code-html" v-html="currentPaneInteractiveHtml" />

            <template #fallback>
              <div class="typed-xlsx-example__code-html" v-html="currentPaneStaticHtml" />
            </template>
          </ClientOnly>
        </div>
      </section>

      <button
        class="typed-xlsx-example__divider"
        type="button"
        aria-label="Resize example panels"
        @pointerdown.prevent="startDragging"
      >
        <span />
      </button>

      <section class="typed-xlsx-example__pane typed-xlsx-example__pane--preview">
        <div class="typed-xlsx-example__preview-header">
          <span>Workbook preview</span>
          <UBadge color="primary" variant="subtle">Excel</UBadge>
        </div>

        <div class="typed-xlsx-example__preview-stage" :class="{ 'is-dragging': dragging }">
          <iframe
            v-if="!iframeFailed"
            :src="iframeUrl"
            v-show="!dragging"
            class="typed-xlsx-example__iframe"
            loading="lazy"
            title="Typed-xlsx financial report preview"
            @error="iframeFailed = true"
          />

          <div
            v-if="dragging && !iframeFailed"
            class="typed-xlsx-example__preview-overlay"
            aria-live="polite"
          >
            <span class="typed-xlsx-example__preview-overlay-badge">Preview paused</span>
            <p>Release the divider to redraw the workbook.</p>
          </div>

          <div v-if="iframeFailed" class="typed-xlsx-example__fallback">
            <p>Microsoft’s viewer could not load the workbook preview.</p>
            <div class="typed-xlsx-example__actions">
              <UButton color="primary" :to="workbookUrl" target="_blank">Open workbook</UButton>
              <UButton
                color="neutral"
                variant="outline"
                to="https://github.com/ChronicStone/typed-xlsx/tree/main/examples"
                target="_blank"
              >
                Browse examples
              </UButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.typed-xlsx-example {
  display: grid;
  gap: 1rem;
}

.typed-xlsx-example__toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem;
}

.typed-xlsx-example__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--ui-primary) 75%, var(--ui-text) 25%);
}

.typed-xlsx-example__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ui-text-highlighted);
}

.typed-xlsx-example__copy {
  margin: 0.4rem 0 0;
  max-width: 42rem;
  color: var(--ui-text-toned);
}

.typed-xlsx-example__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.typed-xlsx-example__split {
  display: grid;
  min-height: 680px;
  max-height: 860px;
  border: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  border-radius: 1.25rem;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ui-bg) 97%, white 3%),
    var(--ui-bg)
  );
}

.typed-xlsx-example__pane {
  min-width: 0;
  min-height: 0;
}

.typed-xlsx-example__pane--code {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 97%, white 3%);
}

.typed-xlsx-example__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.875rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
}

.typed-xlsx-example__code-wrap {
  min-height: 0;
  overflow: auto;
}

.typed-xlsx-example__code-html {
  min-height: 100%;
}

.typed-xlsx-example__code-html:deep(pre.shiki) {
  margin: 0;
  min-height: 100%;
  min-width: max-content;
  padding: 1rem 1.1rem 1.4rem;
  border: 0;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none;
  font-size: 0.84rem;
  line-height: 1.7;
}

.typed-xlsx-example__code-html:deep(pre.shiki code) {
  display: block;
  min-height: 100%;
}

.typed-xlsx-example__code-html:deep(.line) {
  min-height: 1.7em;
}

.typed-xlsx-example__divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: color-mix(in oklab, var(--ui-border) 70%, transparent);
  cursor: col-resize;
}

.typed-xlsx-example__divider span {
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--ui-primary) 24%, white 18%);
}

.typed-xlsx-example__pane--preview {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 99%, white 1%);
}

.typed-xlsx-example__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  color: var(--ui-text-highlighted);
  font-weight: 600;
}

.typed-xlsx-example__preview-stage {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(247 247 245 / 0.98));
}

.dark .typed-xlsx-example__preview-stage {
  background: linear-gradient(180deg, rgb(30 30 26 / 0.96), rgb(20 20 18 / 0.98));
}

.typed-xlsx-example__iframe {
  flex: 1;
  width: 100%;
  min-height: 560px;
  border: 0;
  background: white;
}

.typed-xlsx-example__preview-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 0.7rem;
  padding: 1.5rem;
  text-align: center;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(245 245 241 / 0.92));
  backdrop-filter: blur(8px);
  color: var(--ui-text-highlighted);
}

.dark .typed-xlsx-example__preview-overlay {
  background: linear-gradient(180deg, rgb(24 24 20 / 0.86), rgb(18 18 16 / 0.92));
}

.typed-xlsx-example__preview-overlay-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border: 1px solid color-mix(in oklab, var(--ui-primary) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.typed-xlsx-example__preview-overlay p {
  margin: 0;
  max-width: 18rem;
  color: var(--ui-text-toned);
}

.typed-xlsx-example__fallback {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--ui-text-toned);
}

@media (max-width: 1023px) {
  .typed-xlsx-example__split {
    grid-template-columns: 1fr !important;
    min-height: auto;
    max-height: none;
  }

  .typed-xlsx-example__divider {
    display: none;
  }

  .typed-xlsx-example__pane--code {
    min-height: 24rem;
  }

  .typed-xlsx-example__pane--preview {
    min-height: 26rem;
  }

  .typed-xlsx-example__iframe {
    min-height: 420px;
  }
}
</style>
