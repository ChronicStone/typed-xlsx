<script setup lang="ts">
import {
  getArtifactAccentClass,
  getArtifactCatalog,
  getArtifactLandingEyebrow,
  getArtifactPreviewKind,
} from "../../data/artifactCatalog";

const props = withDefaults(
  defineProps<{
    limit?: number;
    showCta?: boolean;
  }>(),
  {
    limit: undefined,
    showCta: true,
  },
);

const allArtifacts = getArtifactCatalog();
const artifacts = computed(() =>
  props.limit !== undefined ? allArtifacts.slice(0, props.limit) : allArtifacts,
);

function artifactPreviewBars(index: number) {
  const seeds = [0.84, 0.62, 0.74, 0.48, 0.92, 0.58, 0.67, 0.44];
  return seeds.map((value, valueIndex) => {
    const shifted = ((index * 3 + valueIndex) % seeds.length) / 20;
    return `${Math.max(0.28, Math.min(0.96, value - shifted)) * 100}%`;
  });
}

// ── Scroll reveal ─────────────────────────────────────────────────
const rootEl = ref<HTMLElement | null>(null);
useReveal(rootEl);
</script>

<template>
  <div ref="rootEl" class="space-y-4">
    <div
      class="reveal-stagger grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
      style="--reveal-stagger-y: 22px; --reveal-stagger-step: 80ms"
    >
      <UPageCard
        v-for="(artifact, index) in artifacts"
        :key="artifact.id"
        :to="`/playground/${artifact.id}`"
        spotlight
        class="artifact-card rounded-[1.35rem] border border-default/60 bg-default/95"
      >
        <div class="artifact-card__inner flex h-full flex-col gap-3 p-1.5">
          <div :class="['artifact-preview', getArtifactAccentClass(artifact)]">
            <div class="artifact-preview__chrome">
              <span />
              <span />
              <span />
            </div>

            <div class="artifact-preview__body">
              <div class="artifact-preview__title-row">
                <div class="artifact-preview__title-chip" />
                <div class="artifact-preview__title-chip artifact-preview__title-chip--short" />
              </div>

              <template v-if="getArtifactPreviewKind(artifact) === 'stream'">
                <div class="artifact-preview__stream-grid">
                  <div class="artifact-preview__stream-stack">
                    <span v-for="step in 4" :key="step" class="artifact-preview__stream-node" />
                  </div>
                  <div class="artifact-preview__stream-lines">
                    <span
                      v-for="(bar, barIndex) in artifactPreviewBars(index).slice(0, 6)"
                      :key="barIndex"
                      class="artifact-preview__line"
                      :style="{ width: bar }"
                    />
                  </div>
                </div>
              </template>

              <template v-else-if="getArtifactPreviewKind(artifact) === 'matrix'">
                <div class="artifact-preview__matrix">
                  <div class="artifact-preview__matrix-header">
                    <span v-for="column in 5" :key="column" />
                  </div>
                  <div class="artifact-preview__matrix-body">
                    <span v-for="cell in 15" :key="cell" />
                  </div>
                </div>
              </template>

              <template v-else-if="getArtifactPreviewKind(artifact) === 'board'">
                <div class="artifact-preview__board">
                  <div class="artifact-preview__board-hero" />
                  <div class="artifact-preview__board-cards">
                    <span v-for="card in 4" :key="card" />
                  </div>
                  <div class="artifact-preview__board-table">
                    <span
                      v-for="row in 4"
                      :key="row"
                      :style="{ width: artifactPreviewBars(index)[row] }"
                    />
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="artifact-preview__table">
                  <div class="artifact-preview__table-header">
                    <span v-for="column in 4" :key="column" />
                  </div>
                  <div class="artifact-preview__table-body">
                    <span
                      v-for="(bar, barIndex) in artifactPreviewBars(index)"
                      :key="barIndex"
                      class="artifact-preview__line"
                      :style="{ width: bar }"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col px-1 pb-0.5">
            <div class="space-y-1">
              <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
                {{ getArtifactLandingEyebrow(artifact) }}
              </p>
              <h3
                class="artifact-card__title text-[0.98rem] font-bold leading-[1.3] text-highlighted"
              >
                {{ artifact.title }}
              </h3>
              <p class="artifact-card__copy text-[0.92rem] leading-5 text-toned">
                {{ artifact.description }}
              </p>
            </div>

            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <UBadge
                v-for="feature in artifact.features.slice(0, 3)"
                :key="feature"
                color="neutral"
                variant="subtle"
                class="rounded-full font-mono text-[9px]"
              >
                {{ feature }}
              </UBadge>
            </div>

            <div
              class="mt-auto flex items-center justify-between gap-3 border-t border-default/30 pt-2.5"
            >
              <span class="text-[11px] text-toned/70">
                {{ artifact.inspectSummary?.sheetNames.length ?? 0 }}
                {{ (artifact.inspectSummary?.sheetNames.length ?? 0) === 1 ? "sheet" : "sheets" }}
              </span>
              <span
                class="artifact-card__cta flex items-center gap-1 text-[11px] font-semibold text-primary"
              >
                Open playground
                <UIcon name="i-lucide-arrow-right" class="artifact-card__arrow size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </UPageCard>
    </div>

    <div v-if="showCta" class="flex items-center justify-between gap-4 pt-2">
      <p v-if="limit && allArtifacts.length > limit" class="text-sm text-toned">
        Showing {{ limit }} of {{ allArtifacts.length }} artifacts
      </p>
      <div
        class="flex flex-wrap gap-3"
        :class="limit && allArtifacts.length > limit ? '' : 'ml-auto'"
      >
        <UButton
          to="/playground"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
          class="border border-default/60"
        >
          Explore all {{ allArtifacts.length }} artifacts
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artifact-preview {
  overflow: hidden;
  height: 11.2rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in oklab, var(--ui-border) 55%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ui-bg-elevated) 96%, white 4%),
    color-mix(in oklab, var(--ui-bg) 98%, currentColor 2%)
  );
  color: var(--ui-primary);
  box-shadow: inset 0 1px 0 color-mix(in oklab, white 55%, transparent);
  transform-origin: center center;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.artifact-preview__chrome {
  display: flex;
  gap: 0.35rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid color-mix(in oklab, var(--ui-border) 45%, transparent);
}

.artifact-preview__chrome span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in oklab, currentColor 22%, var(--ui-bg-elevated));
  opacity: 0.9;
}

.artifact-preview__body {
  display: grid;
  gap: 0.75rem;
  height: calc(11.2rem - 2rem);
  min-height: 0;
  padding: 0.8rem;
}

.artifact-card {
  height: 100%;
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease,
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: center center;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

.artifact-card:hover {
  border-color: color-mix(in oklab, var(--ui-primary) 22%, var(--ui-border) 78%);
  background: color-mix(in oklab, var(--ui-bg-elevated) 84%, var(--ui-bg) 16%);
  box-shadow: 0 18px 40px -28px color-mix(in oklab, var(--ui-primary) 22%, transparent);
  transform: translateY(-6px) scale(1.015);
}

.artifact-card__inner {
  height: 100%;
  overflow: hidden;
  border-radius: calc(1.35rem - 2px);
}

.artifact-card:hover .artifact-preview {
  border-color: color-mix(in oklab, currentColor 18%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, white 55%, transparent),
    0 18px 34px -30px color-mix(in oklab, currentColor 45%, transparent);
  transform: translateY(-4px) scale(1.01);
}

.artifact-card:hover .artifact-card__arrow {
  transform: translateX(3px);
}

.artifact-card__cta {
  transition: color 0.2s ease;
}

.artifact-card__arrow {
  transition: transform 0.2s ease;
}

.artifact-card__title {
  min-height: 2.35rem;
  line-height: 1.35;
}

.artifact-card__copy {
  min-height: 3.7rem;
}

.artifact-preview__title-row {
  display: flex;
  gap: 0.4rem;
}

.artifact-preview__title-chip {
  width: 5.75rem;
  height: 0.55rem;
  border-radius: 999px;
  background: color-mix(in oklab, currentColor 24%, var(--ui-bg-elevated));
  opacity: 0.95;
}

.artifact-preview__title-chip--short {
  width: 2.25rem;
  opacity: 0.7;
}

.artifact-preview__table,
.artifact-preview__board,
.artifact-preview__matrix,
.artifact-preview__stream-grid {
  display: grid;
  gap: 0.65rem;
}

.artifact-preview__table-header,
.artifact-preview__matrix-header {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
}

.artifact-preview__matrix-header {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.artifact-preview__table-header span,
.artifact-preview__matrix-header span,
.artifact-preview__board-cards span,
.artifact-preview__matrix-body span,
.artifact-preview__stream-node {
  border-radius: 0.5rem;
  background: color-mix(in oklab, currentColor 10%, var(--ui-bg-elevated));
  border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
}

.artifact-preview__table-header span {
  height: 1.7rem;
}

.artifact-preview__table-body,
.artifact-preview__board-table,
.artifact-preview__stream-lines {
  display: grid;
  gap: 0.4rem;
}

.artifact-preview__line {
  display: block;
  height: 0.55rem;
  border-radius: 999px;
  background: color-mix(in oklab, currentColor 24%, var(--ui-bg-elevated));
}

.artifact-preview__board-hero {
  height: 2.7rem;
  border-radius: 0.8rem;
  background: linear-gradient(
    135deg,
    color-mix(in oklab, currentColor 12%, var(--ui-bg-elevated)),
    transparent 72%
  );
  border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
}

.artifact-preview__board-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.artifact-preview__board-cards span {
  height: 2.2rem;
}

.artifact-preview__matrix-body {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.35rem;
}

.artifact-preview__matrix-body span {
  height: 1.55rem;
}

.artifact-preview__stream-grid {
  grid-template-columns: 3.5rem minmax(0, 1fr);
  align-items: stretch;
}

.artifact-preview__stream-stack {
  display: grid;
  gap: 0.4rem;
}

.artifact-preview__stream-node {
  height: 1.55rem;
}

.artifact-accent-emerald {
  color: #34d399;
}

.artifact-accent-cyan {
  color: #22d3ee;
}

.artifact-accent-amber {
  color: #fbbf24;
}

.artifact-accent-rose {
  color: #fb7185;
}

.artifact-accent-violet {
  color: #a78bfa;
}

.artifact-accent-sky {
  color: #38bdf8;
}
</style>
