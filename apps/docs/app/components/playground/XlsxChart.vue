<script setup lang="ts">
import { computed } from "vue";
import type { PreviewChart, PreviewChartSeries } from "typed-xlsx-examples";

/**
 * Draws a native Excel chart from the playground preview model, in Excel's default look:
 * white chart area, light gridlines, legend at the bottom, Office theme colors.
 */
const props = defineProps<{ chart: PreviewChart }>();

const PALETTE = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
  "#264478",
  "#9E480E",
];
const INK = "#595959";
const GRID = "#e4e4e4";

/**
 * Formats a number with the parts of Excel number formats charts use: quoted literals, percent,
 * decimals, thousands separators, and trailing commas that scale by a thousand each.
 */
function fmt(v: number, code?: string) {
  if (!code || code === "General") {
    const abs = Math.abs(v);
    const digits = abs !== 0 && abs < 1 ? 2 : abs < 10 && v % 1 ? 1 : 0;
    return v.toLocaleString("en-US", { maximumFractionDigits: digits });
  }
  const sections = code.split(";");
  const section = (v < 0 && sections[1] ? sections[1] : sections[0])!.replace(/\[[^\]]*\]/g, "");
  const literal = (part: string) => part.replace(/"([^"]*)"/g, "$1").replace(/\\(.)/g, "$1");
  const firstDigit = section.search(/[0#?]/);
  if (firstDigit < 0) return literal(section);
  const lastDigit = Math.max(
    section.lastIndexOf("0"),
    section.lastIndexOf("#"),
    section.lastIndexOf("?"),
  );
  const pattern = section.slice(firstDigit, lastDigit + 1);
  let rest = section.slice(lastDigit + 1);
  const scaleCommas = rest.match(/^,+/)?.[0].length ?? 0;
  rest = rest.slice(scaleCommas);
  const pct = section.includes("%");
  const dec = pattern.match(/\.([0#]+)/)?.[1]?.length ?? 0;
  let n = Math.abs(v) / 1000 ** scaleCommas;
  if (pct) n *= 100;
  const body = n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
    useGrouping: pattern.includes(","),
  });
  const sign = v < 0 && !sections[1] ? "-" : "";
  return `${sign}${literal(section.slice(0, firstDigit))}${body}${literal(rest)}`;
}

/** Excel-like "nice" axis: about five steps of 1, 2, 2.5 or 5 times a power of ten. */
function scale(lo: number, hi: number, min?: number, max?: number) {
  let a = min ?? Math.min(0, lo);
  let b = max ?? (hi <= a ? a + 1 : hi);
  const raw = (b - a) / 5;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
  if (min == null) a = Math.floor(a / step) * step;
  if (max == null) b = Math.ceil(b / step) * step;
  const ticks: number[] = [];
  for (let t = a; t <= b + step / 1e6; t += step) ticks.push(Number(t.toPrecision(12)));
  return { a, b, ticks };
}

const colorOf = (s: PreviewChartSeries, i: number) => s.color ?? PALETTE[i % PALETTE.length]!;

const view = computed(() => {
  const c = props.chart;
  const W = c.w;
  const H = c.h;
  const round = c.series.some((s) => s.kind === "pie" || s.kind === "doughnut");
  const titleH = c.title ? 30 : 10;
  const legendItems = round
    ? (c.series[0]?.cats ?? []).map((name, i) => ({
        name,
        color: c.series[0]?.points?.[i] ?? PALETTE[i % PALETTE.length]!,
      }))
    : c.series.map((s, i) => ({ name: s.name, color: colorOf(s, i), line: s.kind === "line" }));
  const legendH = c.legend && legendItems.length ? 24 : 0;
  return { W, H, round, titleH, legendH, legendItems };
});

/* ---------------- pie and doughnut ---------------- */
const slices = computed(() => {
  const { W, H, titleH, legendH, round } = view.value;
  if (!round) return null;
  const s = props.chart.series[0]!;
  const vals = s.vals.map((v) => Math.max(0, v ?? 0));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = W / 2;
  const cy = titleH + (H - titleH - legendH) / 2;
  const r = Math.max(10, Math.min(W / 2 - 24, (H - titleH - legendH) / 2 - 8));
  const inner = s.kind === "doughnut" ? (r * (props.chart.hole ?? 50)) / 100 : 0;
  let ang = -Math.PI / 2;
  return vals.map((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const a0 = ang;
    const a1 = ang + sweep;
    ang = a1;
    const pt = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
    const large = sweep > Math.PI ? 1 : 0;
    const d = inner
      ? `M${pt(r, a0)} A${r} ${r} 0 ${large} 1 ${pt(r, a1)} L${pt(inner, a1)} A${inner} ${inner} 0 ${large} 0 ${pt(inner, a0)}Z`
      : `M${cx} ${cy} L${pt(r, a0)} A${r} ${r} 0 ${large} 1 ${pt(r, a1)}Z`;
    const mid = (a0 + a1) / 2;
    const lr = inner ? (r + inner) / 2 : r * 0.62;
    const label = !s.labels
      ? null
      : s.labels === "percent"
        ? `${Math.round((v / total) * 100)}%`
        : fmt(v, s.labelFmt);
    return {
      d,
      color: s.points?.[i] ?? PALETTE[i % PALETTE.length]!,
      label,
      lx: cx + lr * Math.cos(mid),
      ly: cy + lr * Math.sin(mid),
    };
  });
});

/* ---------------- category and scatter charts ---------------- */
const plot = computed(() => {
  const { W, H, titleH, legendH, round } = view.value;
  if (round) return null;
  const c = props.chart;
  const scatter = c.series.every((s) => s.kind === "scatter");
  const groups = c.horizontal ? [] : (c.series.find((s) => s.groups?.length)?.groups ?? []);
  const cats = scatter ? [] : (c.series.find((s) => s.cats.length)?.cats ?? []);
  const n = Math.max(cats.length, ...c.series.map((s) => s.vals.length));

  // value extents per axis, stacking per chart kind
  const extent = (onY2: boolean) => {
    let lo = 0;
    let hi = 0;
    const group = c.series.filter((s) => !!s.y2 === onY2);
    const stacked = new Map<string, number[]>();
    for (const s of group) {
      const mode = c.stack?.[s.kind];
      if (mode === "percentStacked") {
        hi = Math.max(hi, 1);
        continue;
      }
      s.vals.forEach((v, i) => {
        if (v == null) return;
        if (mode === "stacked") {
          const key = s.kind + (v < 0 ? "-" : "+");
          const arr = stacked.get(key) ?? [];
          arr[i] = (arr[i] ?? 0) + v;
          stacked.set(key, arr);
          hi = Math.max(hi, arr[i]!);
          lo = Math.min(lo, arr[i]!);
        } else {
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      });
    }
    return { lo, hi, used: group.length > 0 };
  };
  const e1 = extent(false);
  const e2 = extent(true);
  const yAx = c.axes.y ?? {};
  const y2Ax = c.axes.y2 ?? {};
  const xAx = c.axes.x ?? {};
  const pctStack = Object.values(c.stack ?? {}).includes("percentStacked");
  const s1 = scale(e1.lo, e1.hi, yAx.min, yAx.max ?? (pctStack ? 1 : undefined));
  const s2 = e2.used ? scale(e2.lo, e2.hi, y2Ax.min, y2Ax.max) : null;
  const yFmt = yAx.fmt ?? (pctStack ? "0%" : undefined);
  const lab1 = s1.ticks.map((t) => fmt(t, yFmt));
  const lab2 = s2?.ticks.map((t) => fmt(t, y2Ax.fmt)) ?? [];
  const charW = 6.2;
  const horizontal = !!c.horizontal;

  let xs: { a: number; b: number; ticks: number[] } | null = null;
  if (scatter) {
    const all = c.series.flatMap((s) => (s.xs ?? []).filter((v): v is number => v != null));
    xs = scale(Math.min(0, ...all), Math.max(...all, 0), xAx.min, xAx.max);
  }
  const catLabelW = horizontal
    ? Math.min(120, Math.max(...cats.map((t) => t.length), 1) * charW)
    : 0;
  const left =
    10 +
    (yAx.title && !horizontal ? 18 : 0) +
    (horizontal ? catLabelW + 6 : Math.max(...lab1.map((t) => t.length)) * charW + 6);
  const right =
    14 + (s2 ? Math.max(...lab2.map((t) => t.length)) * charW + 6 : 0) + (y2Ax.title ? 18 : 0);
  const top = titleH + 4;
  const bottom = legendH + 22 + (xAx.title ? 16 : 0) + (groups.length ? 16 : 0);
  const px = {
    x: left,
    y: top,
    w: Math.max(20, W - left - right),
    h: Math.max(20, H - top - bottom),
  };

  // value → pixel along the value direction
  const vPos = (v: number, sc: { a: number; b: number }) =>
    horizontal
      ? px.x + ((v - sc.a) / (sc.b - sc.a || 1)) * px.w
      : px.y + px.h - ((v - sc.a) / (sc.b - sc.a || 1)) * px.h;
  const band = (horizontal ? px.h : px.w) / Math.max(1, n);
  const catPos = (i: number) => (horizontal ? px.y : px.x) + band * (i + 0.5);

  const grid = s1.ticks.map((t, i) => ({ p: vPos(t, s1), label: lab1[i]! }));
  const grid2 = s2 ? s2.ticks.map((t, i) => ({ p: vPos(t, s2), label: lab2[i]! })) : [];
  const xTicks = xs
    ? xs.ticks.map((t) => ({
        p: px.x + ((t - xs!.a) / (xs!.b - xs!.a || 1)) * px.w,
        label: fmt(t, xAx.fmt),
      }))
    : [];
  const every = Math.max(1, Math.ceil((cats.length * 7 * charW) / (horizontal ? px.h * 4 : px.w)));
  const catLabels = cats.map((t, i) => ({ p: catPos(i), label: i % every ? "" : t }));
  const groupLabels = groups.map((g, k) => {
    const end = groups[k + 1]?.at ?? n;
    return {
      label: g.label,
      p: (catPos(g.at) + catPos(end - 1)) / 2,
      edge: (horizontal ? px.y : px.x) + band * g.at,
    };
  });

  // bars
  const barSeries = c.series.filter((s) => s.kind === "bar");
  const barStack = c.stack?.bar;
  const clusters = barStack ? 1 : Math.max(1, barSeries.length);
  const barW = (band * 0.62) / clusters;
  const bars: Array<{ x: number; y: number; w: number; h: number; color: string; label?: string }> =
    [];
  const base = new Map<string, number[]>();
  const totals: number[] = [];
  if (barStack === "percentStacked")
    barSeries.forEach((s) => s.vals.forEach((v, i) => (totals[i] = (totals[i] ?? 0) + (v ?? 0))));
  barSeries.forEach((s, k) => {
    const sc = s.y2 && s2 ? s2 : s1;
    const color = colorOf(s, c.series.indexOf(s));
    s.vals.forEach((raw, i) => {
      if (raw == null) return;
      let v = raw;
      if (barStack === "percentStacked") v = totals[i] ? raw / totals[i]! : 0;
      const key = (s.y2 ? "y2" : "y") + (v < 0 ? "-" : "+");
      const stackBase = barStack ? (base.get(key)?.[i] ?? 0) : 0;
      if (barStack) {
        const arr = base.get(key) ?? [];
        arr[i] = stackBase + v;
        base.set(key, arr);
      }
      const p0 = vPos(stackBase, sc);
      const p1 = vPos(stackBase + v, sc);
      const offset = catPos(i) - (barW * clusters) / 2 + (barStack ? 0 : barW * k);
      const label = s.labels ? fmt(raw, s.labelFmt) : undefined;
      bars.push(
        horizontal
          ? { x: Math.min(p0, p1), y: offset, w: Math.abs(p1 - p0), h: barW, color, label }
          : { x: offset, y: Math.min(p0, p1), w: barW, h: Math.abs(p1 - p0), color, label },
      );
    });
  });

  // lines and areas (areas stack among themselves)
  const areaBase: number[] = [];
  const paths = c.series
    .filter((s) => s.kind === "line" || s.kind === "area" || s.kind === "scatter")
    .map((s) => {
      const sc = s.y2 && s2 ? s2 : s1;
      const color = colorOf(s, c.series.indexOf(s));
      const pts: Array<[number, number]> = [];
      const lows: Array<[number, number]> = [];
      s.vals.forEach((v, i) => {
        if (v == null) return;
        const x =
          s.kind === "scatter" && xs
            ? px.x + (((s.xs?.[i] ?? 0) - xs.a) / (xs.b - xs.a || 1)) * px.w
            : catPos(i);
        const stacked = s.kind === "area" && c.stack?.area;
        const b0 = stacked ? (areaBase[i] ?? 0) : 0;
        if (stacked) areaBase[i] = b0 + v;
        pts.push([x, vPos(b0 + v, sc)]);
        lows.push([x, vPos(b0, sc)]);
      });
      const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
      const area =
        s.kind === "area" && pts.length
          ? `${line} ${lows
              .slice()
              .reverse()
              .map((p) => `L${p[0]} ${p[1]}`)
              .join(" ")}Z`
          : null;
      return {
        kind: s.kind,
        color,
        line: s.kind === "scatter" ? null : line,
        area,
        dashed: !!s.dashed,
        dots: s.markers || s.kind === "scatter" ? pts : [],
      };
    });

  return {
    px,
    grid,
    grid2,
    xTicks,
    catLabels,
    groupLabels,
    bars,
    paths,
    horizontal,
    scatter,
    yAx,
    y2Ax,
    xAx,
  };
});
</script>

<template>
  <svg
    class="xc"
    :viewBox="`0 0 ${view.W} ${view.H}`"
    :width="view.W"
    :height="view.H"
    role="img"
    :aria-label="chart.title ?? 'Chart'"
  >
    <rect x="0.5" y="0.5" :width="view.W - 1" :height="view.H - 1" fill="#fff" stroke="#d9d9d9" />
    <text v-if="chart.title" :x="view.W / 2" y="21" text-anchor="middle" font-size="14" :fill="INK">
      {{ chart.title }}
    </text>

    <template v-if="slices">
      <path
        v-for="(sl, i) in slices"
        :key="i"
        :d="sl.d"
        :fill="sl.color"
        stroke="#fff"
        stroke-width="1.5"
      />
      <template v-for="(sl, i) in slices" :key="'l' + i">
        <text
          v-if="sl.label"
          :x="sl.lx"
          :y="sl.ly + 4"
          text-anchor="middle"
          font-size="11"
          fill="#fff"
          font-weight="600"
        >
          {{ sl.label }}
        </text>
      </template>
    </template>

    <template v-else-if="plot">
      <!-- gridlines + value labels -->
      <template v-for="(g, i) in plot.grid" :key="'g' + i">
        <line
          v-if="!plot.horizontal"
          :x1="plot.px.x"
          :x2="plot.px.x + plot.px.w"
          :y1="g.p"
          :y2="g.p"
          :stroke="GRID"
        />
        <line
          v-else
          :x1="g.p"
          :x2="g.p"
          :y1="plot.px.y"
          :y2="plot.px.y + plot.px.h"
          :stroke="GRID"
        />
        <text
          v-if="!plot.horizontal"
          :x="plot.px.x - 6"
          :y="g.p + 3.5"
          text-anchor="end"
          font-size="10"
          :fill="INK"
        >
          {{ g.label }}
        </text>
        <text
          v-else
          :x="g.p"
          :y="plot.px.y + plot.px.h + 14"
          text-anchor="middle"
          font-size="10"
          :fill="INK"
        >
          {{ g.label }}
        </text>
      </template>
      <text
        v-for="(g, i) in plot.grid2"
        :key="'g2' + i"
        :x="plot.px.x + plot.px.w + 6"
        :y="g.p + 3.5"
        font-size="10"
        :fill="INK"
      >
        {{ g.label }}
      </text>
      <!-- scatter x axis -->
      <text
        v-for="(t, i) in plot.xTicks"
        :key="'x' + i"
        :x="t.p"
        :y="plot.px.y + plot.px.h + 14"
        text-anchor="middle"
        font-size="10"
        :fill="INK"
      >
        {{ t.label }}
      </text>
      <!-- category labels -->
      <template v-for="(t, i) in plot.catLabels" :key="'c' + i">
        <text
          v-if="!plot.horizontal"
          :x="t.p"
          :y="plot.px.y + plot.px.h + 14"
          text-anchor="middle"
          font-size="10"
          :fill="INK"
        >
          {{ t.label }}
        </text>
        <text v-else :x="plot.px.x - 6" :y="t.p + 3.5" text-anchor="end" font-size="10" :fill="INK">
          {{ t.label }}
        </text>
      </template>
      <template v-for="(g, i) in plot.groupLabels" :key="'gr' + i">
        <line
          v-if="i > 0"
          :x1="g.edge"
          :x2="g.edge"
          :y1="plot.px.y + plot.px.h"
          :y2="plot.px.y + plot.px.h + 34"
          stroke="#d9d9d9"
        />
        <text
          :x="g.p"
          :y="plot.px.y + plot.px.h + 30"
          text-anchor="middle"
          font-size="10"
          font-weight="600"
          :fill="INK"
        >
          {{ g.label }}
        </text>
      </template>
      <line
        v-if="!plot.scatter"
        :x1="plot.px.x"
        :x2="plot.horizontal ? plot.px.x : plot.px.x + plot.px.w"
        :y1="plot.horizontal ? plot.px.y : plot.px.y + plot.px.h"
        :y2="plot.px.y + plot.px.h"
        stroke="#bfbfbf"
      />
      <!-- axis titles -->
      <text
        v-if="plot.yAx.title"
        :transform="`translate(12 ${plot.px.y + plot.px.h / 2}) rotate(-90)`"
        text-anchor="middle"
        font-size="10.5"
        :fill="INK"
      >
        {{ plot.yAx.title }}
      </text>
      <text
        v-if="plot.y2Ax.title"
        :transform="`translate(${view.W - 10} ${plot.px.y + plot.px.h / 2}) rotate(90)`"
        text-anchor="middle"
        font-size="10.5"
        :fill="INK"
      >
        {{ plot.y2Ax.title }}
      </text>
      <text
        v-if="plot.xAx.title"
        :x="plot.px.x + plot.px.w / 2"
        :y="plot.px.y + plot.px.h + 32"
        text-anchor="middle"
        font-size="10.5"
        :fill="INK"
      >
        {{ plot.xAx.title }}
      </text>

      <path
        v-for="(p, i) in plot.paths.filter((x) => x.area)"
        :key="'a' + i"
        :d="p.area!"
        :fill="p.color"
        fill-opacity="0.85"
      />
      <rect
        v-for="(b, i) in plot.bars"
        :key="'b' + i"
        :x="b.x"
        :y="b.y"
        :width="Math.max(0, b.w)"
        :height="Math.max(0, b.h)"
        :fill="b.color"
      />
      <template v-for="(b, i) in plot.bars" :key="'bl' + i">
        <text
          v-if="b.label"
          :x="plot.horizontal ? b.x + b.w + 4 : b.x + b.w / 2"
          :y="plot.horizontal ? b.y + b.h / 2 + 3.5 : b.y - 4"
          :text-anchor="plot.horizontal ? 'start' : 'middle'"
          font-size="9.5"
          :fill="INK"
        >
          {{ b.label }}
        </text>
      </template>
      <template v-for="(p, i) in plot.paths" :key="'p' + i">
        <path
          v-if="p.line && p.kind === 'line'"
          :d="p.line"
          fill="none"
          :stroke="p.color"
          stroke-width="2.25"
          stroke-linejoin="round"
          stroke-linecap="round"
          :stroke-dasharray="p.dashed ? '6 4' : undefined"
        />
        <circle v-for="(d, j) in p.dots" :key="j" :cx="d[0]" :cy="d[1]" r="3" :fill="p.color" />
      </template>
    </template>

    <!-- legend -->
    <g v-if="view.legendH" :transform="`translate(0 ${view.H - 14})`">
      <foreignObject x="0" y="-9" :width="view.W" height="18">
        <div class="xc-legend">
          <span v-for="(l, i) in view.legendItems" :key="i"
            ><i :class="{ ln: 'line' in l && l.line }" :style="{ background: l.color }" />{{
              l.name
            }}</span
          >
        </div>
      </foreignObject>
    </g>
  </svg>
</template>

<style scoped>
.xc {
  display: block;
  overflow: visible;
  font-family:
    Calibri,
    "Segoe UI",
    -apple-system,
    Arial,
    sans-serif;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.xc-legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px 14px;
  font:
    10.5px/18px Calibri,
    "Segoe UI",
    -apple-system,
    Arial,
    sans-serif;
  color: #595959;
  white-space: nowrap;
  overflow: hidden;
}
.xc-legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  vertical-align: -1px;
}
.xc-legend i.ln {
  height: 2.5px;
  width: 14px;
  vertical-align: 3px;
}
</style>
