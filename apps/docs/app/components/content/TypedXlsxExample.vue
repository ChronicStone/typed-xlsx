<script setup lang="ts">
import { findExampleArtifact } from "../../composables/useExamplesManifest";

const props = withDefaults(
  defineProps<{
    fileKey?: string;
  }>(),
  {
    fileKey: "financial-report",
  },
);

type PaneKey = "schema" | "data" | "workbook";
type PaneDefinition = {
  key: PaneKey;
  label: string;
};

const activePane = ref<PaneKey>("schema");
const split = ref(0.52);
const dragging = ref(false);
const container = ref<HTMLElement | null>(null);
const iframeFailed = ref(false);
const runtimeConfig = useRuntimeConfig();
const exampleArtifact = findExampleArtifact(props.fileKey);

if (!exampleArtifact) {
  throw new Error(`Missing example manifest entry for '${props.fileKey}'`);
}

const normalizedDataSource = exampleArtifact.sourceFiles["data.ts"].trim();
const normalizedSchemaSource = exampleArtifact.sourceFiles["schema.ts"]
  .trim()
  .replaceAll("../../src", "xlsmith");
const normalizedWorkbookSource = (
  exampleArtifact.sourceFiles["workbook.ts"] || exampleArtifact.sourceFiles["file.ts"]
)
  .trim()
  .replaceAll("../../src", "xlsmith");

const panes: PaneDefinition[] = [
  { key: "schema", label: "schema.ts" },
  { key: "data", label: "data.ts" },
  { key: "workbook", label: "workbook.ts" },
];

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
// @filename: workbook.ts
${normalizedWorkbookSource}
`;
}

const currentPane = computed(() => panes.find((pane) => pane.key === activePane.value) ?? panes[0]);
const currentPaneSource = computed(() => buildPaneSource(currentPane.value.key));
const sourceUrl = computed(
  () =>
    `https://github.com/ChronicStone/xlsmith/tree/main/packages/examples/showcase/${props.fileKey}`,
);
const workbookUrl = computed(() => `/generated/examples/reports/${exampleArtifact.reportPath}`);
const previewWorkbookUrl = computed(() => {
  const url = new URL(workbookUrl.value, runtimeConfig.public.siteUrl || "http://localhost:3000");
  url.searchParams.set("preview", runtimeConfig.app.buildId || "dev");
  return url.toString();
});
const iframeUrl = computed(
  () =>
    `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewWorkbookUrl.value)}&action=embedview&wdHideGridlines=True&wdHideHeaders=True&wdAllowInteractivity=False`,
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

onBeforeUnmount(stopDragging);
</script>

<template>
  <div class="xlsmith-example">
    <UPageCard
      spotlight
      class="xlsmith-live-card overflow-hidden rounded-[1.75rem] border border-default/70 bg-default/90"
    >
      <div class="xlsmith-example__toolbar">
        <div>
          <p class="xlsmith-example__eyebrow">Live example</p>
          <h3 class="xlsmith-example__title">Financial report source + workbook preview</h3>
          <p class="xlsmith-example__copy">
            Browse the exact schema, data, and file builder source while previewing the generated
            workbook.
          </p>
        </div>

        <div class="xlsmith-example__actions">
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
            :to="sourceUrl"
            target="_blank"
          >
            View source
          </UButton>
        </div>
      </div>
    </UPageCard>

    <div ref="container" class="xlsmith-example__split" :style="splitStyle">
      <section class="xlsmith-example__pane xlsmith-example__pane--code">
        <div class="xlsmith-example__tabs">
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

        <div class="xlsmith-example__code-wrap">
          <MdcCodeBlock
            :code="currentPaneSource"
            lang="ts"
            twoslash
            class="xlsmith-example__code-html"
          />
        </div>
      </section>

      <button
        class="xlsmith-example__divider"
        type="button"
        aria-label="Resize example panels"
        @pointerdown.prevent="startDragging"
      >
        <span />
      </button>

      <section class="xlsmith-example__pane xlsmith-example__pane--preview">
        <div class="xlsmith-example__preview-header">
          <span>Workbook preview</span>
          <UBadge color="primary" variant="subtle">Excel</UBadge>
        </div>

        <div class="xlsmith-example__preview-stage" :class="{ 'is-dragging': dragging }">
          <iframe
            v-if="!iframeFailed"
            :src="iframeUrl"
            v-show="!dragging"
            class="xlsmith-example__iframe"
            loading="lazy"
            title="xlsmith financial report preview"
            @error="iframeFailed = true"
          />

          <div
            v-if="dragging && !iframeFailed"
            class="xlsmith-example__preview-overlay"
            aria-live="polite"
          >
            <span class="xlsmith-example__preview-overlay-badge">Preview paused</span>
            <p>Release the divider to redraw the workbook.</p>
          </div>

          <div v-if="iframeFailed" class="xlsmith-example__fallback">
            <p>Microsoft’s viewer could not load the workbook preview.</p>
            <div class="xlsmith-example__actions">
              <UButton color="primary" :to="workbookUrl" target="_blank">Open workbook</UButton>
              <UButton color="neutral" variant="outline" :to="sourceUrl" target="_blank">
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
.xlsmith-example {
  display: grid;
  gap: 1rem;
}

.xlsmith-example__toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem;
}

.xlsmith-example__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--ui-primary) 75%, var(--ui-text) 25%);
}

.xlsmith-example__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ui-text-highlighted);
}

.xlsmith-example__copy {
  margin: 0.4rem 0 0;
  max-width: 42rem;
  color: var(--ui-text-toned);
}

.xlsmith-example__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.xlsmith-example__split {
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

.xlsmith-example__pane {
  min-width: 0;
  min-height: 0;
}

.xlsmith-example__pane--code {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 97%, white 3%);
}

.xlsmith-example__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.875rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
}

.xlsmith-example__code-wrap {
  min-height: 0;
  overflow: auto;
}

.xlsmith-example__code-html {
  min-height: 100%;
}

.xlsmith-example__code-html:deep(pre.shiki) {
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

.xlsmith-example__code-html:deep(pre.shiki code) {
  display: block;
  min-height: 100%;
}

.xlsmith-example__code-html:deep(.line) {
  min-height: 1.7em;
}

.xlsmith-example__divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: color-mix(in oklab, var(--ui-border) 70%, transparent);
  cursor: col-resize;
}

.xlsmith-example__divider span {
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--ui-primary) 24%, white 18%);
}

.xlsmith-example__pane--preview {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 99%, white 1%);
}

.xlsmith-example__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  color: var(--ui-text-highlighted);
  font-weight: 600;
}

.xlsmith-example__preview-stage {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(247 247 245 / 0.98));
}

.dark .xlsmith-example__preview-stage {
  background: linear-gradient(180deg, rgb(30 30 26 / 0.96), rgb(20 20 18 / 0.98));
}

.xlsmith-example__iframe {
  flex: 1;
  width: 100%;
  min-height: 560px;
  border: 0;
  background: white;
}

.xlsmith-example__preview-overlay {
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

.dark .xlsmith-example__preview-overlay {
  background: linear-gradient(180deg, rgb(24 24 20 / 0.86), rgb(18 18 16 / 0.92));
}

.xlsmith-example__preview-overlay-badge {
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

.xlsmith-example__preview-overlay p {
  margin: 0;
  max-width: 18rem;
  color: var(--ui-text-toned);
}

.xlsmith-example__fallback {
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
  .xlsmith-example__split {
    grid-template-columns: 1fr !important;
    min-height: auto;
    max-height: none;
  }

  .xlsmith-example__divider {
    display: none;
  }

  .xlsmith-example__pane--code {
    min-height: 24rem;
  }

  .xlsmith-example__pane--preview {
    min-height: 26rem;
  }

  .xlsmith-example__iframe {
    min-height: 420px;
  }
}
</style>
