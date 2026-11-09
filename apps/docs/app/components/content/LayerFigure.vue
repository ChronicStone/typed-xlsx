<script setup lang="ts">
/**
 * An exploded isometric stack, like the landing hero: one slab per layer, labelled on the right.
 * The first layer is drawn on top. Use it for precedence and containment.
 *
 * ::layer-figure
 * ---
 * layers:
 *   - { cap: Conditional styles, code: "conditionalStyle", note: "applied by Excel last", accent: true }
 *   - { cap: Theme, code: "defineSpreadsheetTheme()", note: "defaults for every slot" }
 * ---
 * ::
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    layers: Array<{ cap: string; code?: string; note?: string; accent?: boolean }>;
    caption?: string;
    /** label above the top slab, e.g. "wins" */
    topLabel?: string;
    bottomLabel?: string;
  }>(),
  {},
);

/* isometric projection, as in the landing's stream machine */
const C30 = 0.866;
const S30 = 0.5;
const P = (x: number, y: number, z = 0) => [(x - y) * C30, (x + y) * S30 - z] as const;
const W = 190;
const D = 120;
const GAP = 46;
const T = 6;
const pts = (a: ReadonlyArray<readonly [number, number]>) =>
  a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

const slabs = computed(() => {
  const n = props.layers.length;
  return props.layers.map((layer, i) => {
    const z = (n - 1 - i) * GAP;
    const top = pts([P(0, 0, z + T), P(W, 0, z + T), P(W, D, z + T), P(0, D, z + T)]);
    const left = pts([P(0, D, z), P(W, D, z), P(W, D, z + T), P(0, D, z + T)]);
    const right = pts([P(W, 0, z), P(W, D, z), P(W, D, z + T), P(W, 0, z + T)]);
    const lines: string[] = [];
    for (let k = 1; k < 5; k++) {
      const [x1, y1] = P((W / 5) * k, 0, z + T);
      const [x2, y2] = P((W / 5) * k, D, z + T);
      lines.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    for (let k = 1; k < 4; k++) {
      const [x1, y1] = P(0, (D / 4) * k, z + T);
      const [x2, y2] = P(W, (D / 4) * k, z + T);
      lines.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    // the rightmost corner of the top face anchors the leader line
    const [ax, ay] = P(W, 0, z + T);
    return { ...layer, i, top, left, right, grid: lines.join(""), ax, ay };
  });
});
const box = computed(() => {
  const n = props.layers.length;
  const [, minY] = P(0, 0, (n - 1) * GAP + T);
  const [, maxY] = P(W, D, 0);
  const [minX] = P(0, D);
  const [maxX] = P(W, 0);
  return { x: minX - 10, y: minY - 12, w: maxX - minX + 20, h: maxY - minY + 24 };
});
</script>

<template>
  <figure class="lf not-prose">
    <div class="lf-body">
      <svg class="lf-svg" :viewBox="`${box.x} ${box.y} ${box.w} ${box.h}`" aria-hidden="true">
        <g
          v-for="s in [...slabs].reverse()"
          :key="s.cap"
          class="slab"
          :class="{ accent: s.accent }"
        >
          <polygon class="f-l" :points="s.left" />
          <polygon class="f-r" :points="s.right" />
          <polygon class="f-t" :points="s.top" />
          <path class="grid" :d="s.grid" />
          <circle class="anc" :cx="s.ax" :cy="s.ay" r="2.6" />
          <text class="num" :x="s.ax + 9" :y="s.ay + 4">{{ s.i + 1 }}</text>
        </g>
      </svg>
      <ol class="lf-legend">
        <li v-if="topLabel" class="lf-edge">{{ topLabel }}</li>
        <li v-for="s in slabs" :key="'l' + s.cap" :class="{ accent: s.accent }">
          <span class="no">{{ s.i + 1 }}</span>
          <span class="txt">
            <b>{{ s.cap }}</b>
            <code v-if="s.code">{{ s.code }}</code>
            <span v-if="s.note" class="note">{{ s.note }}</span>
          </span>
        </li>
        <li v-if="bottomLabel" class="lf-edge">{{ bottomLabel }}</li>
      </ol>
    </div>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.lf {
  margin: 1.75rem 0;
}
.lf-body {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background:
    radial-gradient(closest-side at 30% 55%, var(--doc-accent-soft, transparent), transparent 80%),
    color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
}
.lf-svg {
  width: 100%;
  max-height: 360px;
  overflow: visible;
}
.slab .f-t {
  fill: color-mix(in oklab, var(--ui-primary) 5%, var(--ui-bg));
  stroke: var(--ui-border-accented);
  stroke-width: 1;
}
.slab .f-l {
  fill: color-mix(in oklab, var(--ui-primary) 14%, var(--ui-bg));
  stroke: var(--ui-border-accented);
  stroke-width: 0.8;
}
.slab .f-r {
  fill: color-mix(in oklab, var(--ui-primary) 9%, var(--ui-bg));
  stroke: var(--ui-border-accented);
  stroke-width: 0.8;
}
.slab .grid {
  fill: none;
  stroke: var(--ui-border-muted);
  stroke-width: 0.8;
}
.slab .anc {
  fill: var(--ui-bg);
  stroke: var(--ui-text-muted);
  stroke-width: 1.2;
}
.slab .num {
  font: 500 11px var(--font-mono);
  fill: var(--ui-text-muted);
}
.slab.accent .num {
  fill: var(--ui-primary);
}
.slab.accent .f-t {
  fill: color-mix(in oklab, var(--ui-primary) 18%, var(--ui-bg));
  stroke: var(--ui-primary);
}
.slab.accent .grid {
  stroke: color-mix(in oklab, var(--ui-primary) 35%, transparent);
}
.slab.accent .anc {
  stroke: var(--ui-primary);
  fill: var(--ui-primary);
}
.lf-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
  border: 1px solid var(--ui-border-accented);
  border-radius: 6px;
  background: var(--ui-bg);
  overflow: hidden;
}
.lf-legend li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  margin: 0;
  padding: 0;
}
.lf-legend li + li {
  border-top: 1px solid var(--ui-border-muted);
}
.lf-legend .no {
  display: grid;
  place-items: center;
  border-right: 1px solid var(--ui-border-muted);
  font: 500 11.5px/1 var(--font-mono);
  color: var(--ui-text-muted);
}
.lf-legend li.accent .no {
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
}
.lf-legend .txt {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 12px;
  min-width: 0;
}
.lf-legend b {
  font-weight: 650;
  font-size: 0.92rem;
  color: var(--ui-text-highlighted);
}
.lf-legend code {
  font: 500 0.76rem/1.3 var(--font-mono);
  color: var(--ui-primary);
  background: none;
  padding: 0;
}
.lf-legend .note {
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--ui-text-toned);
}
.lf-legend .lf-edge {
  display: block;
  padding: 6px 12px;
  font: 500 10px/1.2 var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
  background: color-mix(in oklab, var(--ui-bg-elevated) 80%, transparent);
}
figcaption {
  margin: 10px 2px 0;
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}
@media (max-width: 720px) {
  .lf-body {
    grid-template-columns: 1fr;
  }
  .lf-svg {
    max-height: 240px;
  }
}
</style>
