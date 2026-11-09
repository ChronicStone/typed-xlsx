<script setup lang="ts">
/**
 * A left-to-right pipeline drawn like the landing's blueprint: numbered stations joined by
 * dimension-style arrows.
 *
 * ::flow-figure
 * ---
 * steps:
 *   - { cap: Schema, code: "createExcelSchema<T>()", note: "columns, formulas, styles" }
 *   - { cap: Output, code: "toBuffer()", note: "file, buffer or stream", accent: true }
 * ---
 * ::
 */
withDefaults(
  defineProps<{
    steps: Array<{ cap: string; code?: string; note?: string; accent?: boolean }>;
    caption?: string;
  }>(),
  {},
);
</script>

<template>
  <figure class="ff not-prose">
    <ol class="ff-row">
      <li v-for="(s, i) in steps" :key="s.cap" class="ff-step" :class="{ accent: s.accent }">
        <div class="ff-node">
          <span class="ff-cap"
            ><b>{{ String(i + 1).padStart(2, "0") }}</b
            >{{ s.cap }}</span
          >
          <code v-if="s.code" class="ff-code">{{ s.code }}</code>
          <span v-if="s.note" class="ff-note">{{ s.note }}</span>
        </div>
        <svg v-if="i < steps.length - 1" class="ff-arrow" viewBox="0 0 40 12" aria-hidden="true">
          <path d="M0 6h36M30 1l6 5-6 5" />
        </svg>
      </li>
    </ol>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.ff {
  margin: 1.75rem 0;
}
.ff-row {
  list-style: none;
  margin: 0;
  padding: 14px;
  display: flex;
  align-items: stretch;
  gap: 0;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background:
    linear-gradient(var(--doc-grid-major, transparent) 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(90deg, var(--doc-grid-major, transparent) 1px, transparent 1px) 0 0 / 24px 24px,
    color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
  overflow-x: auto;
}
.ff-step {
  display: flex;
  align-items: center;
  flex: 1 1 0;
  min-width: 160px;
  margin: 0;
  padding: 0;
}
.ff-node {
  flex: 1;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--ui-border-accented);
  border-radius: 6px;
  background: var(--ui-bg);
}
.ff-step.accent .ff-node {
  border-color: var(--ui-primary);
  box-shadow: inset 0 0 0 1px var(--ui-primary);
}
.ff-cap {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 500 10.5px/1 var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
}
.ff-cap b {
  font-weight: 500;
  color: var(--ui-primary);
}
.ff-code {
  font: 500 11px/1.45 var(--font-mono);
  font-variant-ligatures: none;
  color: var(--ui-text-highlighted);
  background: none;
  padding: 0;
  /* wrap between tokens, never inside an identifier */
  overflow-wrap: normal;
  word-break: keep-all;
}
.ff-note {
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--ui-text-toned);
}
.ff-arrow {
  flex: none;
  width: 22px;
  height: 12px;
  margin: 0 3px;
}
.ff-arrow path {
  fill: none;
  stroke: var(--ui-primary);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 3 3;
  animation: ff-flow 1.2s linear infinite;
}
@keyframes ff-flow {
  to {
    stroke-dashoffset: -12;
  }
}
figcaption {
  margin: 10px 2px 0;
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}
@media (max-width: 720px) {
  .ff-row {
    flex-direction: column;
  }
  .ff-step {
    flex-direction: column;
    align-items: stretch;
  }
  .ff-arrow {
    transform: rotate(90deg);
    align-self: center;
    margin: 6px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ff-arrow path {
    animation: none;
  }
}
</style>
