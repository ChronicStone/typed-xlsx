<script setup lang="ts">
import {
  findArtifactCatalogEntry,
  getArtifactGithubUrl,
  getArtifactPlaygroundSummary,
  getArtifactSourcePanes,
  getArtifactWorkbookUrl,
} from "../../data/artifactCatalog";
import MdcCodeBlock from "../../components/content/MdcCodeBlock.vue";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const colorMode = useColorMode();

const artifactId = computed(() => String(route.params.id || ""));
const artifact = computed(() => findArtifactCatalogEntry(artifactId.value));

if (!artifact.value) {
  throw createError({ statusCode: 404, statusMessage: "Artifact not found", fatal: true });
}

const sourcePanes = computed(() => getArtifactSourcePanes(artifact.value!));
const inspectFiles = computed(() =>
  (artifact.value?.inspectSummary?.inspectFiles ?? []).filter((file) => !file.endsWith(".xlsx")),
);

function getTreeItemIcon(item: { kind: "source" | "inspect"; lang: string; label: string }) {
  if (item.lang === "ts") return "i-vscode-icons-file-type-typescript-official";
  if (item.lang === "xml") return "i-vscode-icons-file-type-xml";
  if (item.lang === "json") return "i-vscode-icons-file-type-json";
  return item.kind === "source" ? "i-lucide-file-code-2" : "i-lucide-file";
}

function formatXml(input: string) {
  const tokens = input
    .replace(/>\s*</g, "><")
    .replace(/</g, "\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let indent = 0;

  return tokens
    .map((token) => {
      if (/^<\?xml/.test(token) || /^<!/.test(token)) {
        return token;
      }

      if (/^<\//.test(token)) {
        indent = Math.max(indent - 1, 0);
      }

      const formatted = `${"  ".repeat(indent)}${token}`;

      if (/^<[^!?/][^>]*>$/.test(token) && !/\/>$/.test(token) && !token.includes("</")) {
        indent += 1;
      }

      return formatted;
    })
    .join("\n");
}

const treeItems = computed(() => {
  if (!artifact.value) return [];

  const sourceItems = sourcePanes.value.map((pane) => ({
    kind: "source" as const,
    key: pane.key,
    label: pane.key,
    lang: pane.key.endsWith(".ts") ? "ts" : "text",
    code: (artifact.value!.sourceFiles[pane.key] ?? "").trim(),
  }));

  const inspectItems = inspectFiles.value.map((file) => ({
    kind: "inspect" as const,
    key: `inspect/${file}`,
    label: file,
    lang: file.endsWith(".json") ? "json" : file.endsWith(".xml") ? "xml" : "text",
    code: null,
  }));

  return [
    {
      group: "Source",
      items: sourceItems,
    },
    {
      group: "Artifacts",
      items: inspectItems,
    },
  ];
});

const activeFileKey = ref(sourcePanes.value[0]?.key ?? "workbook.ts");
const activeTreeKey = computed(() => activeFileKey.value);
const activeTreeItem = computed(
  () =>
    treeItems.value
      .flatMap((group) => group.items)
      .find((item) => item.key === activeTreeKey.value) ?? treeItems.value[0]?.items[0],
);

const inspectContent = ref<string | null>(null);
const inspectLoading = ref(false);

watch(
  activeTreeItem,
  async (item) => {
    inspectContent.value = null;

    if (!item || item.kind !== "inspect") return;

    inspectLoading.value = true;
    try {
      const content = await $fetch<string>(
        `/generated/examples/showcase/${artifact.value!.id}/artifact/inspect/${item.label}`,
      );

      inspectContent.value = item.lang === "xml" ? formatXml(content) : content;
    } catch {
      inspectContent.value = `// Failed to load ${item.label}`;
    } finally {
      inspectLoading.value = false;
    }
  },
  { immediate: true },
);

const split = ref(0.48);
const dragging = ref(false);
const container = ref<HTMLElement | null>(null);
const iframeFailed = ref(false);
const treeCollapsed = ref(false);
const displayMode = ref<"split" | "code" | "preview">("split");
const codeTheme = computed(() => (colorMode.value === "dark" ? "vitesse-dark" : "vitesse-light"));

const workbookUrl = computed(() => getArtifactWorkbookUrl(artifact.value!));
const githubUrl = computed(() => getArtifactGithubUrl(artifact.value!));
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
  split.value = Math.min(0.72, Math.max(0.28, ratio));
}

function startDragging() {
  dragging.value = true;
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", stopDragging);
}

function toggleTreeCollapsed() {
  treeCollapsed.value = !treeCollapsed.value;
}

function setDisplayMode(mode: "split" | "code" | "preview") {
  displayMode.value = mode;
}

onBeforeUnmount(stopDragging);

watch(artifactId, () => {
  activeFileKey.value = sourcePanes.value[0]?.key ?? "workbook.ts";
  iframeFailed.value = false;
});

useSeo({
  title: computed(() => `${artifact.value?.title ?? "Artifact"} Playground`),
  description: computed(
    () => artifact.value?.description ?? "Generated typed-xlsx artifact playground.",
  ),
  type: "website",
});
</script>

<template>
  <main
    class="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UButton
        to="/playground"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        size="sm"
        class="border border-default/60"
      >
        All artifacts
      </UButton>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          size="sm"
          :to="workbookUrl"
          target="_blank"
          icon="i-lucide-download"
        >
          Download workbook
        </UButton>
        <UButton
          color="neutral"
          size="sm"
          variant="ghost"
          :to="githubUrl"
          target="_blank"
          icon="i-simple-icons-github"
          class="border border-default/60"
        >
          Browse source
        </UButton>
      </div>
    </div>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start">
      <div class="space-y-3">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
          {{ artifact.preview.landingEyebrow }}
        </p>
        <h1
          class="max-w-4xl text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          {{ artifact.title }}
        </h1>
        <p class="max-w-3xl text-pretty text-base leading-7 text-toned sm:text-lg">
          {{ getArtifactPlaygroundSummary(artifact) }}
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <UBadge
            v-for="tag in artifact.tags"
            :key="tag"
            color="neutral"
            variant="subtle"
            class="rounded-full font-mono text-[10px]"
          >
            {{ tag }}
          </UBadge>
        </div>
      </div>

      <UPageCard spotlight class="rounded-[1.75rem] border border-default/60 bg-default/95">
        <div class="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">Dataset</p>
            <p class="mt-2 text-base font-bold capitalize text-highlighted">
              {{ artifact.datasetProfile }}
            </p>
          </div>
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">Sheets</p>
            <p class="mt-2 text-base font-bold text-highlighted">
              {{ artifact.inspectSummary?.sheetNames.length ?? 0 }}
            </p>
          </div>
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
              Artifacts
            </p>
            <p class="mt-2 text-base font-bold text-highlighted">{{ inspectFiles.length }}</p>
          </div>
        </div>
      </UPageCard>
    </section>

    <div
      ref="container"
      :class="['playground-split', `is-${displayMode}-mode`]"
      :style="displayMode === 'split' ? splitStyle : undefined"
    >
      <section v-if="displayMode !== 'preview'" class="playground-pane playground-pane--code">
        <div class="playground-pane__header">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
              Code + artifacts
            </p>
            <div class="mt-1 flex items-center gap-2">
              <button
                type="button"
                class="playground-tree-toggle"
                :aria-label="treeCollapsed ? 'Expand file tree' : 'Collapse file tree'"
                @click="toggleTreeCollapsed"
              >
                <UIcon
                  :name="treeCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
                  class="size-4"
                />
              </button>
              <p class="text-sm font-semibold text-highlighted">File tree</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="playground-mode-switch">
              <button
                type="button"
                :class="['playground-mode-switch__button', displayMode === 'split' && 'is-active']"
                @click="setDisplayMode('split')"
              >
                Split
              </button>
              <button
                type="button"
                :class="['playground-mode-switch__button', displayMode === 'code' && 'is-active']"
                @click="setDisplayMode('code')"
              >
                Code
              </button>
              <button
                type="button"
                :class="[
                  'playground-mode-switch__button',
                  displayMode === 'preview' && 'is-active',
                ]"
                @click="setDisplayMode('preview')"
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        <div :class="['playground-code-layout', { 'is-tree-collapsed': treeCollapsed }]">
          <aside class="playground-tree">
            <div v-for="group in treeItems" :key="group.group" class="playground-tree__group">
              <p class="playground-tree__group-label">{{ group.group }}</p>
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                :class="['playground-tree__item', item.key === activeTreeKey ? 'is-active' : '']"
                @click="activeFileKey = item.key"
              >
                <UIcon :name="getTreeItemIcon(item)" class="size-4 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </aside>

          <div class="playground-code-viewer">
            <div class="playground-code-viewer__header">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-file-code-2" class="size-4 text-primary/70" />
                <div>
                  <p class="text-sm font-semibold text-highlighted">{{ activeTreeItem?.label }}</p>
                  <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-toned/60">
                    {{ activeTreeItem?.kind === "source" ? "Source file" : "Generated artifact" }}
                  </p>
                </div>
              </div>
            </div>

            <div class="playground-code-viewer__body">
              <MdcCodeBlock
                v-if="activeTreeItem?.kind === 'source'"
                :key="`${activeTreeItem.key}:${activeTreeItem.lang}:${activeTreeItem.kind}:${codeTheme}`"
                :code="activeTreeItem.code || ''"
                :lang="activeTreeItem.lang"
                :theme="codeTheme"
                class="artifact-code"
              />

              <div v-else-if="inspectLoading" class="flex h-full items-center justify-center py-20">
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                  />
                  <p class="text-xs text-toned">Loading {{ activeTreeItem?.label }}…</p>
                </div>
              </div>

              <MdcCodeBlock
                v-else-if="activeTreeItem?.kind === 'inspect' && inspectContent"
                :key="`${activeTreeItem.key}:${activeTreeItem.lang}:${activeTreeItem.kind}:${codeTheme}`"
                :code="inspectContent"
                :lang="activeTreeItem.lang"
                :theme="codeTheme"
                class="artifact-code"
              />
            </div>
          </div>
        </div>
      </section>

      <button
        v-if="displayMode === 'split'"
        class="playground-divider"
        type="button"
        aria-label="Resize playground panels"
        @pointerdown.prevent="startDragging"
      >
        <span />
      </button>

      <section v-if="displayMode !== 'code'" class="playground-pane playground-pane--preview">
        <div class="playground-pane__header">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
              Workbook preview
            </p>
            <p class="mt-1 text-sm font-semibold text-highlighted">Excel output</p>
          </div>
          <div class="flex items-center gap-2">
            <div v-if="displayMode === 'preview'" class="playground-mode-switch">
              <button
                type="button"
                :class="['playground-mode-switch__button', displayMode === 'split' && 'is-active']"
                @click="setDisplayMode('split')"
              >
                Split
              </button>
              <button
                type="button"
                :class="['playground-mode-switch__button', displayMode === 'code' && 'is-active']"
                @click="setDisplayMode('code')"
              >
                Code
              </button>
              <button
                type="button"
                :class="[
                  'playground-mode-switch__button',
                  displayMode === 'preview' && 'is-active',
                ]"
                @click="setDisplayMode('preview')"
              >
                Preview
              </button>
            </div>
            <UBadge color="primary" variant="subtle" class="font-mono text-[10px]">Excel</UBadge>
          </div>
        </div>

        <div class="playground-preview-stage" :class="{ 'is-dragging': dragging }">
          <iframe
            v-if="!iframeFailed"
            :src="iframeUrl"
            v-show="!dragging"
            class="playground-iframe"
            loading="lazy"
            :title="`${artifact.title} workbook preview`"
            @error="iframeFailed = true"
          />

          <div
            v-if="dragging && !iframeFailed"
            class="playground-preview-overlay"
            aria-live="polite"
          >
            <span class="playground-preview-overlay__badge">Preview paused</span>
            <p>Release the divider to redraw the workbook.</p>
          </div>

          <div v-if="iframeFailed" class="playground-fallback">
            <p>Microsoft’s viewer could not load the workbook preview.</p>
            <div class="flex flex-wrap justify-center gap-3">
              <UButton color="primary" :to="workbookUrl" target="_blank">Download workbook</UButton>
              <UButton
                color="neutral"
                variant="ghost"
                :to="githubUrl"
                target="_blank"
                class="border border-default/60"
              >
                Browse source
              </UButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.playground-split {
  display: grid;
  height: min(980px, calc(100vh - var(--ui-header-height) - 4rem));
  min-height: 0;
  max-height: none;
  border: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  border-radius: 1.5rem;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ui-bg) 97%, white 3%),
    var(--ui-bg)
  );
}

.playground-split.is-code-mode,
.playground-split.is-preview-mode {
  grid-template-columns: minmax(0, 1fr) !important;
}

.playground-pane {
  min-width: 0;
  min-height: 0;
}

.playground-pane--code {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 97%, white 3%);
}

.playground-pane--preview {
  display: flex;
  flex-direction: column;
  background: color-mix(in oklab, var(--ui-bg) 99%, white 1%);
}

.playground-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
}

.playground-code-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.playground-code-layout.is-tree-collapsed {
  grid-template-columns: 0 minmax(0, 1fr);
}

.playground-mode-switch {
  display: inline-flex;
  align-items: center;
  border: 1px solid color-mix(in oklab, var(--ui-border) 72%, transparent);
  border-radius: 0.75rem;
  background: color-mix(in oklab, var(--ui-bg-elevated) 65%, transparent);
  padding: 0.125rem;
}

.playground-mode-switch__button {
  border: 0;
  border-radius: 0.6rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ui-text-toned);
  transition:
    background 150ms ease,
    color 150ms ease;
}

.playground-mode-switch__button.is-active {
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  color: var(--ui-text-highlighted);
}

.playground-tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  margin-left: -0.1rem;
  color: var(--ui-text-toned);
  transition: color 150ms ease;
}

.playground-tree-toggle:hover {
  color: var(--ui-text-highlighted);
}

.playground-tree {
  min-height: 0;
  overflow: auto;
  border-right: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  background: color-mix(in oklab, var(--ui-bg-elevated) 38%, transparent);
  padding: 0.9rem;
  min-width: 0;
  transition:
    border-color 160ms ease,
    opacity 160ms ease,
    padding 160ms ease;
}

.playground-code-layout.is-tree-collapsed .playground-tree {
  overflow: hidden;
  border-right-color: transparent;
  padding-left: 0;
  padding-right: 0;
  opacity: 0;
}

.playground-tree__group + .playground-tree__group {
  margin-top: 1rem;
}

.playground-tree__group-label {
  margin-bottom: 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ui-text-toned);
}

.playground-tree__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  border-radius: 0.8rem;
  padding: 0.55rem 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--ui-text-toned);
  text-align: left;
  transition:
    background 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.playground-tree__item:hover {
  background: color-mix(in oklab, var(--ui-bg) 88%, var(--ui-primary) 4%);
}

.playground-tree__item.is-active {
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  color: var(--ui-text-highlighted);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ui-primary) 26%, transparent);
}

.playground-code-viewer {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.playground-code-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
}

.playground-code-viewer__body {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0.35rem 0.5rem 0.5rem;
}

.artifact-code :deep(pre.shiki) {
  margin: 0;
  width: max-content;
  min-width: 100%;
  padding: 0.7rem 0.8rem 1rem;
  border: 0;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none;
  font-size: 0.84rem;
  line-height: 1.7;
  overflow-x: visible;
  overscroll-behavior-x: contain;
  white-space: pre !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
}

.artifact-code :deep(.shiki) {
  display: block;
  min-height: 100%;
}

.artifact-code :deep(code) {
  display: inline-block;
  min-width: max-content;
  white-space: pre !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
}

.artifact-code :deep(.line) {
  min-height: 1.7em;
  white-space: pre !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
}

.playground-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: color-mix(in oklab, var(--ui-border) 70%, transparent);
  cursor: col-resize;
}

.playground-divider span {
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--ui-primary) 24%, white 18%);
}

.playground-preview-stage {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(247 247 245 / 0.98));
}

.dark .playground-preview-stage {
  background: linear-gradient(180deg, rgb(30 30 26 / 0.96), rgb(20 20 18 / 0.98));
}

.playground-iframe {
  flex: 1;
  width: 100%;
  min-height: 620px;
  border: 0;
  background: white;
}

.playground-preview-overlay {
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

.dark .playground-preview-overlay {
  background: linear-gradient(180deg, rgb(24 24 20 / 0.86), rgb(18 18 16 / 0.92));
}

.playground-preview-overlay__badge {
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

.playground-preview-overlay p {
  margin: 0;
  max-width: 18rem;
  color: var(--ui-text-toned);
}

.playground-fallback {
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
  .playground-split {
    grid-template-columns: 1fr !important;
    min-height: auto;
    max-height: none;
  }

  .playground-divider {
    display: none;
  }

  .playground-code-layout {
    grid-template-columns: 1fr;
  }

  .playground-tree {
    border-right: 0;
    border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 70%, transparent);
  }

  .playground-iframe {
    min-height: 420px;
  }
}
</style>
