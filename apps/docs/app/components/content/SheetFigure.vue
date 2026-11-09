<script setup lang="ts">
/**
 * A small worksheet drawn in the docs: column letters, row numbers, merges, highlighted ranges with
 * a numbered legend, and an optional input panel. Used instead of flowcharts wherever the thing being
 * explained is a sheet.
 *
 * ::sheet-figure
 * ---
 * input: "{ customer: 'Acme', amounts: [100, 120, 140] }"
 * columns: [Customer, Amount]
 * rows: [[Acme, 100], [null, 120], [null, 140]]
 * merges: [A2:A4]
 * marks: [{ range: A2:A4, label: "merged parent cell" }]
 * ---
 * ::
 */
import { computed } from "vue";

type CellValue = string | number | boolean | null;
type Mark = { range: string; label: string };

const props = withDefaults(
  defineProps<{
    columns?: string[];
    rows?: CellValue[][];
    title?: string;
    summary?: CellValue[];
    /** several summary rows below the data */
    summaries?: CellValue[][];
    merges?: string[];
    marks?: Mark[];
    widths?: number[];
    align?: Array<"l" | "c" | "r">;
    /** first worksheet row number shown */
    startRow?: number;
    input?: string;
    inputLabel?: string;
    sheet?: string;
    caption?: string;
    /** "table" draws a native Excel table header with filter buttons */
    variant?: "report" | "table";
    /** style ranges directly, for sheets holding several tables: { "A1:B1": "title", "A2:B2": "head" } */
    regions?: Record<string, "title" | "head" | "sum">;
    /** frozen rows and columns, drawn as Excel's freeze lines */
    freeze?: { rows?: number; cols?: number };
  }>(),
  {
    columns: () => [],
    rows: () => [],
    merges: () => [],
    marks: () => [],
    startRow: 1,
    inputLabel: "Input",
    variant: "report",
  },
);

const RN = 34;
const HEAD = 22;
const ROW = 30;
const MARK_COLORS = ["#2a78d6", "#008300", "#d95926", "#6250d6"];

const colLetter = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const parseRef = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]!) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { c, r: Number(m[2]) };
};
const parseRange = (ref: string) => {
  const [a, b] = ref.split(":");
  const s = parseRef(a ?? "");
  const e = parseRef(b ?? a ?? "");
  return s && e
    ? {
        r1: Math.min(s.r, e.r),
        c1: Math.min(s.c, e.c),
        r2: Math.max(s.r, e.r),
        c2: Math.max(s.c, e.c),
      }
    : null;
};

/* sheet rows in order: optional title, header, data, summary */
type RowKind = "title" | "head" | "data" | "sum";
const sheetRows = computed(() => {
  const out: Array<{ kind: RowKind; cells: CellValue[] }> = [];
  if (props.title) out.push({ kind: "title", cells: [props.title] });
  if (props.columns.length) out.push({ kind: "head", cells: props.columns });
  for (const r of props.rows) out.push({ kind: "data", cells: r });
  if (props.summary) out.push({ kind: "sum", cells: props.summary });
  for (const r of props.summaries ?? []) out.push({ kind: "sum", cells: r });
  return out;
});
const nCols = computed(() =>
  Math.max(
    props.columns.length,
    props.summary?.length ?? 0,
    ...(props.summaries ?? []).map((r) => r.length),
    ...props.rows.map((r) => r.length),
    1,
  ),
);
const display = (v: CellValue) =>
  v == null
    ? ""
    : typeof v === "number"
      ? v.toLocaleString("en-US")
      : typeof v === "boolean"
        ? v
          ? "TRUE"
          : "FALSE"
        : v;
const widths = computed(() =>
  Array.from({ length: nCols.value }, (_, c) => {
    if (props.widths?.[c]) return props.widths[c]!;
    const longest = Math.max(
      ...sheetRows.value
        .filter((r) => r.kind !== "title")
        .map((r) => String(display(r.cells[c] ?? null)).length),
      4,
    );
    return Math.min(240, Math.max(64, Math.round(longest * 7.6 + 22)));
  }),
);
const rowNumber = (i: number) => props.startRow + i;
const grid = computed(() => ({
  gridTemplateColumns: `${RN}px ${widths.value.map((w) => `${w}px`).join(" ")}`,
  gridTemplateRows: `${HEAD}px repeat(${sheetRows.value.length}, ${ROW}px)`,
}));

const merges = computed(() => {
  const anchors = new Map<string, { rows: number; cols: number }>();
  const covered = new Set<string>();
  const all = [...props.merges];
  if (props.title) all.push(`A${props.startRow}:${colLetter(nCols.value)}${props.startRow}`);
  for (const ref of all) {
    const m = parseRange(ref);
    if (!m) continue;
    anchors.set(`${m.c1}:${m.r1}`, { rows: m.r2 - m.r1 + 1, cols: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r++)
      for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(`${c}:${r}`);
  }
  return { anchors, covered };
});

const regionList = computed(() =>
  Object.entries(props.regions ?? {}).flatMap(([ref, kind]) => {
    const g = parseRange(ref);
    return g ? [{ ...g, kind }] : [];
  }),
);
const regionKind = (r: number, c: number) =>
  regionList.value.find((g) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2)?.kind;
const dataIndex = (i: number) => i - sheetRows.value.findIndex((r) => r.kind === "data");
const cells = computed(() => {
  const out: Array<{
    key: string;
    style: Record<string, string>;
    cls: string[];
    text: string;
    formula: boolean;
  }> = [];
  sheetRows.value.forEach((row, i) => {
    const r = rowNumber(i);
    for (let c = 1; c <= nCols.value; c++) {
      const k = `${c}:${r}`;
      if (merges.value.covered.has(k)) continue;
      const span = merges.value.anchors.get(k);
      const v = row.cells[c - 1] ?? null;
      const text = String(display(v));
      const formula = typeof v === "string" && v.startsWith("=");
      const a =
        props.align?.[c - 1] ?? (typeof v === "number" ? "r" : row.kind === "head" ? "l" : "l");
      out.push({
        key: k,
        style: {
          gridRow: `${i + 2} / span ${span?.rows ?? 1}`,
          gridColumn: `${c + 1} / span ${span?.cols ?? 1}`,
        },
        cls: [
          `k-${regionKind(r, c) ?? row.kind}`,
          `a-${a}`,
          ...(formula ? ["fx"] : []),
          ...(props.variant === "table" && row.kind === "head" ? ["filter"] : []),
          ...(props.variant === "table" && row.kind === "data" && dataIndex(i) % 2 === 1
            ? ["band"]
            : []),
        ],
        text,
        formula,
      });
    }
  });
  return out;
});

const left = (c: number) => RN + widths.value.slice(0, c - 1).reduce((a, b) => a + b, 0);
const top = (r: number) => HEAD + (r - props.startRow) * ROW;
const overlays = computed(() =>
  props.marks.map((m, i) => {
    const g = parseRange(m.range);
    const color = MARK_COLORS[i % MARK_COLORS.length]!;
    if (!g) return { i, color, label: m.label, range: m.range, box: null };
    return {
      i,
      color,
      label: m.label,
      range: m.range,
      box: {
        left: `${left(g.c1)}px`,
        top: `${top(g.r1)}px`,
        width: `${left(g.c2 + 1) - left(g.c1)}px`,
        height: `${(g.r2 - g.r1 + 1) * ROW}px`,
      },
    };
  }),
);
const totalWidth = computed(() => left(nCols.value + 1));
const freezeLines = computed(() => {
  const out: Array<Record<string, string>> = [];
  if (props.freeze?.rows)
    out.push({
      left: `${RN}px`,
      right: "0",
      top: `${top(props.startRow + props.freeze.rows) - 1}px`,
      height: "2px",
    });
  if (props.freeze?.cols)
    out.push({
      top: `${HEAD}px`,
      bottom: props.sheet ? "24px" : "0",
      left: `${left(props.freeze.cols + 1) - 1}px`,
      width: "2px",
    });
  return out;
});
</script>

<template>
  <figure class="sf not-prose">
    <div class="sf-body" :class="{ split: !!input }">
      <div v-if="input" class="sf-input">
        <span class="sf-k">{{ inputLabel }}</span>
        <pre><code>{{ input }}</code></pre>
      </div>
      <div v-if="input" class="sf-arrow" aria-hidden="true">
        <svg viewBox="0 0 48 12"><path d="M0 6h44M38 1l6 5-6 5" /></svg>
      </div>
      <div class="sf-scroll">
        <div class="sf-sheet" :style="{ width: `${totalWidth}px` }">
          <div class="sf-grid" :style="grid">
            <div class="h corner" />
            <div
              v-for="c in nCols"
              :key="'h' + c"
              class="h"
              :style="{ gridRow: 1, gridColumn: c + 1 }"
            >
              {{ colLetter(c) }}
            </div>
            <div
              v-for="(_, i) in sheetRows"
              :key="'r' + i"
              class="h rn"
              :style="{ gridRow: i + 2, gridColumn: 1 }"
            >
              {{ rowNumber(i) }}
            </div>
            <div
              v-for="cell in cells"
              :key="cell.key"
              class="c"
              :class="cell.cls"
              :style="cell.style"
            >
              <span class="t">{{ cell.text }}</span>
            </div>
          </div>
          <div
            v-for="o in overlays"
            v-show="o.box"
            :key="'m' + o.i"
            class="mark"
            :style="{ ...o.box, '--mc': o.color }"
          >
            <span class="badge">{{ o.i + 1 }}</span>
          </div>
          <i v-for="(f, k) in freezeLines" :key="'fz' + k" class="freeze" :style="f" />
          <div v-if="sheet" class="tabs">
            <span>{{ sheet }}</span>
          </div>
        </div>
      </div>
    </div>
    <ol v-if="marks.length" class="sf-legend">
      <li v-for="o in overlays" :key="'l' + o.i" :style="{ '--mc': o.color }">
        <span class="badge">{{ o.i + 1 }}</span
        ><code>{{ o.range }}</code
        ><span>{{ o.label }}</span>
      </li>
    </ol>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.sf {
  margin: 1.75rem 0;
}
.sf-body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
  overflow: hidden;
}
.sf-input {
  flex: none;
  max-width: 280px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--doc-code-bg, #071510);
  border: 1px solid var(--doc-code-line, rgba(205, 240, 220, 0.12));
}
.sf-k {
  display: block;
  font: 500 10px/1 var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5d7a6a;
  margin-bottom: 8px;
}
.sf-input pre {
  margin: 0;
  padding: 0;
  background: none;
  border: 0;
  white-space: pre-wrap;
  font: 12px/1.6 var(--font-mono);
  color: #d6eadd;
}
.sf-arrow svg {
  width: 44px;
  height: 12px;
  display: block;
}
.sf-arrow path {
  fill: none;
  stroke: var(--ui-primary);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sf-scroll {
  min-width: 0;
  overflow-x: auto;
  flex: 1;
}
.sf-sheet {
  position: relative;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #c9d6ce;
  box-shadow: 0 18px 36px -24px rgba(16, 60, 36, 0.45);
  color: #13241a;
  font:
    13px/1.2 Calibri,
    Carlito,
    "Segoe UI",
    -apple-system,
    system-ui,
    sans-serif;
}
.sf-grid {
  display: grid;
}
.h {
  display: grid;
  place-items: center;
  background: #eef3f0;
  color: #6e8277;
  font: 500 10.5px/1 var(--font-mono);
  border-right: 1px solid #dfe7e2;
  border-bottom: 1px solid #dfe7e2;
}
.h.corner {
  grid-row: 1;
  grid-column: 1;
}
.c {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 6px;
  overflow: hidden;
  white-space: nowrap;
  border-right: 1px solid #e3eae6;
  border-bottom: 1px solid #e3eae6;
  font-variant-numeric: tabular-nums;
}
.t {
  overflow: hidden;
  text-overflow: ellipsis;
}
.a-r {
  justify-content: flex-end;
}
.a-c {
  justify-content: center;
}
.k-title {
  justify-content: flex-start;
  background: #0e3b26;
  color: #f1fbf5;
  font-weight: 800;
  border-color: #0e3b26;
}
.k-head {
  background: #17603d;
  color: #fff;
  font-weight: 700;
  border-color: #124d31;
}
.k-head.filter {
  justify-content: space-between;
  gap: 6px;
}
.k-head.filter::after {
  content: "";
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5l3 3 3-3' fill='none' stroke='%23334155' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")
    center / 9px no-repeat;
}
.band {
  background: #e9eef8;
}
.k-sum {
  background: #e7f4ec;
  font-weight: 800;
  border-top: 1.5px solid #17603d;
}
.fx .t {
  font: 500 11.5px/1 var(--font-mono);
  font-variant-ligatures: none;
  color: #0f6b3e;
}
.freeze {
  position: absolute;
  background: #8a9d93;
  pointer-events: none;
}
.mark {
  position: absolute;
  pointer-events: none;
  border: 2px solid var(--mc);
  background: color-mix(in srgb, var(--mc) 9%, transparent);
}
.badge {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--mc);
  color: #fff;
  font: 600 10.5px/1 var(--font-mono);
  flex: none;
}
.mark .badge {
  position: absolute;
  top: -10px;
  right: -10px;
  box-shadow: 0 0 0 2px #fff;
}
.tabs {
  display: flex;
  height: 24px;
  border-top: 1px solid #d8e3dc;
  background: #f3f7f5;
  font-size: 11.5px;
}
.tabs span {
  display: flex;
  align-items: center;
  padding: 0 14px;
  background: #fff;
  color: #17603d;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 #17603d;
}
.sf-legend {
  list-style: none;
  margin: 10px 2px 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.sf-legend li {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.88rem;
  color: var(--ui-text-toned);
}
.sf-legend code {
  font: 500 0.78rem/1 var(--font-mono);
  color: var(--ui-text-highlighted);
  background: none;
  padding: 0;
  min-width: 52px;
}
figcaption {
  margin: 10px 2px 0;
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}
@media (max-width: 640px) {
  .sf-body.split {
    flex-direction: column;
    align-items: stretch;
  }
  .sf-input {
    max-width: none;
  }
  .sf-arrow {
    transform: rotate(90deg);
    align-self: center;
  }
}
</style>
