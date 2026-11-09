<script setup lang="ts">
import { computed } from "vue";
import type {
  PreviewCell,
  PreviewSheet,
  PreviewSparkline,
  PreviewStyle,
} from "typed-xlsx-examples";
import { colLetter, parseCellRef, parseRangeRef, tableStyleColors } from "./xlsx";
import XlsxChart from "./XlsxChart.vue";

const props = withDefaults(
  defineProps<{
    sheet: PreviewSheet;
    styles: PreviewStyle[];
    dxfs: PreviewStyle[];
    /** clickable cells, selection, column headers */
    interactive?: boolean;
    zoom?: number;
    selected?: string | null;
    selectedCol?: number | null;
    /** empty rows/columns drawn past the used range, like a real worksheet */
    extraRows?: number;
    extraCols?: number;
    /** hide the column letter header (gallery thumbnails) */
    compact?: boolean;
    /** thumbnails: shrink merged cells so they end within this width (unzoomed px) */
    clipWidth?: number;
  }>(),
  {
    interactive: false,
    zoom: 1,
    selected: null,
    selectedCol: null,
    extraRows: 0,
    extraCols: 0,
    compact: false,
  },
);
const emit = defineEmits<{ "select-cell": [ref: string]; "select-col": [col: number] }>();

const RN_W = 40;
const HEAD_H = 22;

/* ---------- geometry ---------- */
const nCols = computed(() => props.sheet.cols + props.extraCols);
const colWidths = computed(() =>
  Array.from({ length: nCols.value }, (_, i) => props.sheet.colWidths[i] ?? 64),
);
/** visible row numbers in order; null marks the elided gap of a long streamed sheet */
const rowList = computed(() => {
  const out: Array<number | null> = [];
  const { rows, gap } = props.sheet;
  for (let r = 1; r <= rows + props.extraRows; r++) {
    if (gap && r > gap.after && r <= gap.after + gap.hidden) {
      if (r === gap.after + 1) out.push(null);
      continue;
    }
    out.push(r);
  }
  return out;
});
const GAP_H = 34;
const rowHeight = (r: number | null) =>
  r == null ? GAP_H : (props.sheet.rowHeights[r] ?? props.sheet.defaultRowHeight);
const gridRowOf = computed(() => {
  const m = new Map<number, number>();
  rowList.value.forEach((r, i) => r != null && m.set(r, i + (props.compact ? 1 : 2)));
  return m;
});
const gridStyle = computed(() => ({
  gridTemplateColumns: `${RN_W}px ${colWidths.value.map((w) => `${w}px`).join(" ")}`,
  gridTemplateRows: `${props.compact ? "" : `${HEAD_H}px `}${rowList.value.map((r) => `${rowHeight(r)}px`).join(" ")}`,
  zoom: props.zoom,
}));

/* ---------- freeze panes ---------- */
const frozenRows = computed(() => props.sheet.freeze?.rows ?? 0);
const frozenCols = computed(() => props.sheet.freeze?.cols ?? 0);
const stickyTop = (r: number) => {
  let y = props.compact ? 0 : HEAD_H;
  for (let k = 1; k < r; k++) y += rowHeight(k);
  return y;
};
const stickyLeft = (c: number) => RN_W + colWidths.value.slice(0, c - 1).reduce((a, b) => a + b, 0);

/* ---------- merges ---------- */
const merges = computed(() => {
  const anchors = new Map<string, { rows: number; cols: number }>();
  const covered = new Set<string>();
  for (const ref of props.sheet.merges) {
    const m = parseRangeRef(ref);
    if (!m) continue;
    anchors.set(`${colLetter(m.c1)}${m.r1}`, { rows: m.r2 - m.r1 + 1, cols: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r++)
      for (let c = m.c1; c <= m.c2; c++)
        if (r !== m.r1 || c !== m.c1) covered.add(`${colLetter(c)}${r}`);
  }
  return { anchors, covered };
});

/* ---------- table styling ---------- */
const tableRole = computed(() => {
  const roles = new Map<
    string,
    {
      role: "head" | "band" | "body" | "total";
      colors: ReturnType<typeof tableStyleColors>;
      filter: boolean;
    }
  >();
  for (const t of props.sheet.tables) {
    const range = parseRangeRef(t.ref);
    if (!range) continue;
    const colors = tableStyleColors(t.style);
    for (let r = range.r1; r <= range.r2; r++) {
      const isHead = t.header && r === range.r1;
      const isTotal = t.totals && r === range.r2;
      const dataIndex = r - range.r1 - (t.header ? 1 : 0);
      const role = isHead
        ? "head"
        : isTotal
          ? "total"
          : t.stripes && dataIndex % 2 === 0
            ? "band"
            : "body";
      for (let c = range.c1; c <= range.c2; c++)
        roles.set(`${colLetter(c)}${r}`, { role, colors, filter: isHead && t.filter });
    }
  }
  return roles;
});

const validationCells = computed(() => {
  const m = new Map<string, true>();
  for (const v of props.sheet.validations) {
    if (v.type !== "list") continue;
    for (const part of v.ref.split(/\s+/)) {
      const range = parseRangeRef(part);
      if (!range) continue;
      for (let r = range.r1; r <= range.r2; r++)
        for (let c = range.c1; c <= range.c2; c++) m.set(`${colLetter(c)}${r}`, true);
    }
  }
  return m;
});

const sparkByCell = computed(() => new Map(props.sheet.sparklines.map((s) => [s.cell, s])));

/* ---------- style → css ---------- */
function styleCss(s: PreviewStyle | undefined, base: Record<string, string> = {}) {
  const css: Record<string, string> = { ...base };
  if (!s) return css;
  if (s.f) css.background = s.f;
  if (s.c) css.color = s.c;
  if (s.b) css.fontWeight = "700";
  if (s.i) css.fontStyle = "italic";
  if (s.u || s.st)
    css.textDecoration = [s.u ? "underline" : "", s.st ? "line-through" : ""].join(" ").trim();
  if (s.sz) css.fontSize = `${s.sz}px`;
  if (s.bt) css.borderTop = s.bt;
  if (s.br) css.borderRight = s.br;
  if (s.bb) css.borderBottom = s.bb;
  if (s.bl) css.borderLeft = s.bl;
  if (s.wrap) {
    css.whiteSpace = "normal";
    css.lineHeight = "1.25";
  }
  if (s.ind) css.paddingLeft = `${4 + s.ind * 9}px`;
  return css;
}

function clipSpan(c: number, span: number) {
  if (!props.clipWidth || span <= 1) return span;
  let right = stickyLeft(c);
  let n = 0;
  while (n < span && (n === 0 || right + colWidths.value[c - 1 + n]! <= props.clipWidth)) {
    right += colWidths.value[c - 1 + n]!;
    n++;
  }
  return Math.max(1, n);
}

type RenderCell = {
  ref: string;
  r: number;
  c: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  cell?: PreviewCell;
  css: Record<string, string>;
  cls: string[];
  checkbox?: boolean;
  checked?: boolean;
  spark?: PreviewSparkline;
  filter?: boolean;
  dropdown?: boolean;
  link?: boolean;
};

const renderCells = computed<RenderCell[]>(() => {
  const out: RenderCell[] = [];
  const { anchors, covered } = merges.value;
  for (const r of rowList.value) {
    if (r == null) continue;
    const gridRow = gridRowOf.value.get(r)!;
    for (let c = 1; c <= nCols.value; c++) {
      const ref = `${colLetter(c)}${r}`;
      if (covered.has(ref)) continue;
      const cell = props.sheet.cells[ref];
      const span = anchors.get(ref);
      const base = cell?.s != null ? props.styles[cell.s] : undefined;
      const tr = tableRole.value.get(ref);
      const tableCss: Record<string, string> = {};
      if (tr) {
        if (tr.role === "head" && !base?.f) {
          tableCss.background = tr.colors.head;
          tableCss.color = tr.colors.headText;
          tableCss.fontWeight = "700";
        } else if (tr.role === "band" && !base?.f && tr.colors.band)
          tableCss.background = tr.colors.band;
        else if (tr.role === "total") {
          tableCss.fontWeight = "700";
          tableCss.borderTop = `3px double ${tr.colors.line}`;
        }
      }
      const css = styleCss(cell?.cf != null ? { ...base, ...props.dxfs[cell.cf] } : base, tableCss);
      const cls: string[] = [];
      const kind = cell?.t;
      const ha =
        base?.ha ?? (kind === "n" ? "right" : kind === "b" || kind === "e" ? "center" : "left");
      cls.push(`ha-${ha === "centerContinuous" ? "center" : ha}`);
      cls.push(`va-${base?.va ?? "bottom"}`);
      if (base?.wrap) cls.push("wraptext");
      if (props.selectedCol === c) cls.push("csel");
      if (props.selected === ref) cls.push("sel");
      if (c <= frozenCols.value) cls.push("fz-c");
      if (r <= frozenRows.value) cls.push("fz-r");
      if (c === frozenCols.value) cls.push("fz-edge-c");
      if (r === frozenRows.value) cls.push("fz-edge-r");
      if (r <= frozenRows.value) css.top = `${stickyTop(r)}px`;
      if (c <= frozenCols.value) css.left = `${stickyLeft(c)}px`;
      out.push({
        ref,
        r,
        c,
        row: gridRow,
        col: c + 1,
        rowSpan: span?.rows ?? 1,
        colSpan: clipSpan(c, span?.cols ?? 1),
        cell,
        css,
        cls,
        checkbox: !!base?.cb && kind === "b",
        checked: cell?.v === "TRUE",
        spark: sparkByCell.value.get(ref),
        filter: tr?.filter,
        dropdown: props.interactive && props.selected === ref && validationCells.value.has(ref),
        link: !!props.sheet.links[ref],
      });
    }
  }
  return out;
});

/* ---------- sparklines ---------- */
function sparkPath(s: PreviewSparkline, w: number, h: number) {
  const vals = s.values.map((v) => (v == null ? null : v));
  const nums = vals.filter((v): v is number => v != null);
  if (!nums.length)
    return {
      line: "",
      dots: [] as Array<{ x: number; y: number; c: string }>,
      bars: [] as Array<{ x: number; y: number; w: number; h: number; c: string }>,
    };
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const pad = 3;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  if (s.type === "column" || s.type === "stacked") {
    const bw = (w - pad * 2) / vals.length - 2;
    return {
      line: "",
      dots: [],
      bars: vals.flatMap((v, i) =>
        v == null
          ? []
          : [
              {
                x: pad + i * ((w - pad * 2) / vals.length) + 1,
                y: y(Math.max(v, 0)),
                w: bw,
                h: Math.max(1, Math.abs(y(v) - y(Math.max(min, 0)))),
                c: v === max && s.high ? s.high : v === min && s.low ? s.low : s.color,
              },
            ],
      ),
    };
  }
  const pts = vals
    .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean);
  const dots: Array<{ x: number; y: number; c: string }> = [];
  vals.forEach((v, i) => {
    if (v == null) return;
    let c = s.markers;
    if (s.high && v === max) c = s.high;
    else if (s.low && v === min) c = s.low;
    else if (s.first && i === 0) c = s.first;
    else if (s.last && i === vals.length - 1) c = s.last;
    if (c) dots.push({ x: x(i), y: y(v), c });
  });
  return { line: pts.join(" "), dots, bars: [] };
}

function onCellClick(rc: RenderCell) {
  if (props.interactive) emit("select-cell", rc.ref);
}
function onColClick(c: number) {
  if (props.interactive) emit("select-col", c);
}
const cornerLeft = computed(() => RN_W);
const contentTop = computed(() => (props.compact ? 0 : HEAD_H));
const totalHidden = computed(() => props.sheet.gap?.hidden ?? 0);
defineExpose({ parseCellRef });
</script>

<template>
  <div class="xs" :class="{ interactive, compact }">
    <div class="xs-grid" :style="gridStyle">
      <template v-if="!compact">
        <div class="xs-h corner" />
        <button
          v-for="c in nCols"
          :key="'h' + c"
          type="button"
          class="xs-h colh"
          :class="{ on: selectedCol === c || (selected && parseCellRef(selected)?.c === c) }"
          :data-col="c"
          :style="{
            gridRow: 1,
            gridColumn: c + 1,
            ...(c <= frozenCols ? { left: `${stickyLeft(c)}px`, zIndex: 7 } : {}),
          }"
          :tabindex="interactive ? 0 : -1"
          @click="onColClick(c)"
        >
          {{ colLetter(c) }}
        </button>
      </template>
      <template v-for="(r, i) in rowList" :key="'r' + i">
        <div
          v-if="r != null"
          class="xs-h rowh"
          :class="{ on: selected && parseCellRef(selected)?.r === r, 'fz-r': r <= frozenRows }"
          :style="{
            gridRow: gridRowOf.get(r),
            gridColumn: 1,
            ...(r <= frozenRows ? { top: `${stickyTop(r)}px` } : {}),
          }"
        >
          {{ r }}
        </div>
        <div
          v-else
          class="xs-gap"
          :style="{ gridRow: i + (compact ? 1 : 2), gridColumn: `1 / span ${nCols + 1}` }"
        >
          <span>⋯ {{ totalHidden.toLocaleString("en-US") }} more rows in the file ⋯</span>
        </div>
      </template>
      <div
        v-for="rc in renderCells"
        :key="rc.ref"
        class="xs-c"
        :class="rc.cls"
        :data-ref="rc.ref"
        :style="{
          gridRow: `${rc.row} / span ${rc.rowSpan}`,
          gridColumn: `${rc.col} / span ${rc.colSpan}`,
          ...rc.css,
        }"
        @click="onCellClick(rc)"
      >
        <template v-if="rc.checkbox">
          <svg class="xs-cb" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" :class="{ on: rc.checked }" />
            <path v-if="rc.checked" d="M4.5 8.2l2.3 2.3 4.7-5" />
          </svg>
        </template>
        <img v-else-if="rc.cell?.src" class="xs-img" :src="rc.cell.src" alt="" loading="lazy" />
        <svg
          v-else-if="rc.spark"
          class="xs-spark"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <template v-for="p in [sparkPath(rc.spark, 100, 24)]" :key="'s'">
            <polyline
              v-if="p.line"
              :points="p.line"
              :stroke="rc.spark.color"
              :stroke-width="(rc.spark.weight ?? 1) * 1.4"
              fill="none"
              vector-effect="non-scaling-stroke"
            />
            <rect
              v-for="(b, k) in p.bars"
              :key="'b' + k"
              :x="b.x"
              :y="b.y"
              :width="b.w"
              :height="b.h"
              :fill="b.c"
            />
            <circle
              v-for="(d, k) in p.dots"
              :key="'d' + k"
              :cx="d.x"
              :cy="d.y"
              r="1.6"
              :fill="d.c"
              vector-effect="non-scaling-stroke"
            />
          </template>
        </svg>
        <span v-else class="xs-t">{{ rc.cell?.v }}</span>
        <span v-if="rc.filter" class="xs-filter" aria-hidden="true"
          ><svg viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" /></svg
        ></span>
        <span v-if="rc.dropdown" class="xs-dd" aria-hidden="true"
          ><svg viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" /></svg
        ></span>
      </div>
      <img
        v-for="(img, k) in sheet.images"
        :key="'img' + k"
        class="xs-pic"
        :src="img.src"
        :alt="img.alt"
        :style="{
          left: `${cornerLeft + img.x}px`,
          top: `${contentTop + img.y}px`,
          width: `${img.w}px`,
          height: `${img.h}px`,
        }"
      />
      <XlsxChart
        v-for="(ch, k) in sheet.charts ?? []"
        :key="'chart' + k"
        class="xs-chart"
        :chart="ch"
        :style="{ left: `${cornerLeft + ch.x}px`, top: `${contentTop + ch.y}px` }"
      />
    </div>
  </div>
</template>

<style scoped>
.xs {
  --xs-grid: #e2e8e4;
  --xs-head: #f1f5f2;
  --xs-head-ink: #66796e;
  --xs-sel: #17603d;
  background: #fff;
  color: #1f2937;
  font:
    14.67px/1.2 Calibri,
    Carlito,
    "Segoe UI",
    -apple-system,
    system-ui,
    sans-serif;
}
.xs-grid {
  position: relative;
  display: grid;
  width: max-content;
}
.xs-h {
  position: sticky;
  z-index: 3;
  display: grid;
  place-items: center;
  background: var(--xs-head);
  color: var(--xs-head-ink);
  font:
    500 11px/1 "JetBrains Mono",
    ui-monospace,
    Menlo,
    monospace;
  border-right: 1px solid var(--xs-grid);
  border-bottom: 1px solid var(--xs-grid);
  padding: 0;
}
.xs-h.corner {
  grid-row: 1;
  grid-column: 1;
  top: 0;
  left: 0;
  z-index: 8;
}
.xs-h.colh {
  top: 0;
  z-index: 6;
}
.xs-h.rowh {
  left: 0;
  z-index: 4;
}
.xs-h.rowh.fz-r {
  z-index: 7;
}
.compact .xs-h.rowh {
  font-size: 9px;
}
.interactive .xs-h.colh {
  cursor: pointer;
}
.xs-h.on {
  background: #cfe9da;
  color: #0f5132;
  font-weight: 700;
}
.xs-c {
  position: relative;
  display: flex;
  min-width: 0;
  padding: 1px 4px;
  overflow: hidden;
  white-space: nowrap;
  background: #fff;
  border-right: 1px solid var(--xs-grid);
  border-bottom: 1px solid var(--xs-grid);
  font-variant-numeric: tabular-nums;
}
.interactive .xs-c {
  cursor: cell;
}
.xs-t {
  min-width: 0;
  overflow: hidden;
}
.ha-left,
.ha-general {
  justify-content: flex-start;
}
.ha-right {
  justify-content: flex-end;
}
.ha-center,
.ha-centerContinuous,
.ha-justify,
.ha-fill,
.ha-distributed {
  justify-content: center;
  text-align: center;
}
.va-top {
  align-items: flex-start;
}
.va-center {
  align-items: center;
}
.va-bottom {
  align-items: flex-end;
}
.wraptext .xs-t {
  white-space: normal;
}
.fz-r,
.fz-c {
  position: sticky;
  z-index: 2;
}
.fz-r.fz-c {
  z-index: 3;
}
.fz-edge-r {
  box-shadow: inset 0 -2px 0 #8a9d93;
}
.fz-edge-c {
  box-shadow: inset -2px 0 0 #8a9d93;
}
.fz-edge-r.fz-edge-c {
  box-shadow:
    inset 0 -2px 0 #8a9d93,
    inset -2px 0 0 #8a9d93;
}
.xs-c.csel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(23, 96, 61, 0.08);
  pointer-events: none;
}
.xs-c.sel {
  outline: 2px solid var(--xs-sel);
  outline-offset: -2px;
  z-index: 1;
}
.xs-c.sel.fz-r,
.xs-c.sel.fz-c {
  z-index: 4;
}
.xs-cb {
  width: 16px;
  height: 16px;
  margin: auto;
  flex: none;
}
.xs-cb rect {
  fill: #fff;
  stroke: #7b8a82;
  stroke-width: 1.2;
}
.xs-cb rect.on {
  fill: #107c41;
  stroke: #107c41;
}
.xs-cb path {
  fill: none;
  stroke: #fff;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.xs-img {
  max-height: calc(100% - 4px);
  max-width: 100%;
  margin: auto 0;
  object-fit: contain;
}
.xs-spark {
  width: calc(100% - 4px);
  height: calc(100% - 8px);
  margin: auto;
}
.xs-filter,
.xs-dd {
  flex: none;
  width: 15px;
  height: 15px;
  margin: auto 0 auto 4px;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1px solid #c9d1cc;
  border-radius: 2px;
}
.xs-dd {
  position: absolute;
  right: -18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
}
.xs-filter svg,
.xs-dd svg {
  width: 9px;
  height: 9px;
}
.xs-filter path,
.xs-dd path {
  fill: none;
  stroke: #334155;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.xs-pic {
  position: absolute;
  z-index: 3;
  pointer-events: none;
}
/* above the cells, below frozen rows and columns, as charts scroll under panes in Excel */
.xs-chart {
  position: absolute;
  z-index: 1;
}
.xs-gap {
  display: grid;
  place-items: center;
  background: repeating-linear-gradient(-45deg, #f6f8f7 0 6px, #eef2ef 6px 12px);
  border-bottom: 1px solid var(--xs-grid);
  color: #5b6f64;
  font:
    500 12px/1 "JetBrains Mono",
    ui-monospace,
    monospace;
  position: sticky;
  left: 0;
}
.xs-gap span {
  position: sticky;
  left: 50%;
}
</style>
