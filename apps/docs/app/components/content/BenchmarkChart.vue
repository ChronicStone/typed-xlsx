<script setup lang="ts">
/**
 * Charts from the streaming throughput report (packages/benchmark/artifacts/reports/stream),
 * read straight from its JSON so the docs never restate numbers by hand.
 *
 * ::benchmark-chart{metric="time"}   total export time, 4.2.0 vs current, per workload
 * ::benchmark-chart{metric="rss"}    peak resident memory, same workloads
 * ::benchmark-chart{metric="app"}    the real 202k-row application export, by phase
 */
import { computed, ref } from "vue";

type Run = {
  variant: "baseline" | "optimized";
  layout: "flat" | "stacked";
  strings: "inline" | "shared";
  logicalRows: number;
  totalMs: number;
  maxRssMb: number;
};
type Report = {
  date: string;
  hardware: { cpu: string; memoryGiB: number; os: string };
  baseline: { version: string };
  runtime: string;
  runs: Run[];
  application: {
    rows: number;
    columns: number;
    timingsMs: Record<
      "baseline" | "optimized",
      Record<"fetch" | "commit" | "progress" | "finalize" | "upload" | "job", number>
    >;
  };
};

const reports = import.meta.glob<Report>(
  "../../../public/generated/benchmark/stream/throughput-*.json",
  {
    eager: true,
    import: "default",
  },
);
const report = Object.entries(reports).sort(([a], [b]) => b.localeCompare(a))[0]?.[1];

const props = withDefaults(defineProps<{ metric?: "time" | "rss" | "app"; caption?: string }>(), {
  metric: "time",
});

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const WORKLOADS = [
  { layout: "flat", strings: "shared", rows: 200_000, label: "200k rows, shared strings" },
  { layout: "flat", strings: "inline", rows: 200_000, label: "200k rows, inline strings" },
  { layout: "stacked", strings: "inline", rows: 200_000, label: "200k rows, stacked layout" },
  { layout: "flat", strings: "inline", rows: 500_000, label: "500k rows, inline strings" },
] as const;

const SERIES = [
  { key: "baseline", label: `${report?.baseline.version ?? "4.2.0"}`, color: "var(--bc-1)" },
  { key: "optimized", label: "current", color: "var(--bc-2)" },
] as const;

const pairs = computed(() => {
  if (!report || props.metric === "app") return [];
  return WORKLOADS.map((w) => {
    const pick = (variant: Run["variant"]) => {
      const runs = report.runs.filter(
        (r) =>
          r.variant === variant &&
          r.layout === w.layout &&
          r.strings === w.strings &&
          r.logicalRows === w.rows,
      );
      return median(runs.map((r) => (props.metric === "time" ? r.totalMs / 1000 : r.maxRssMb)));
    };
    return { label: w.label, baseline: pick("baseline"), optimized: pick("optimized") };
  });
});
const unit = computed(() => (props.metric === "time" ? "s" : "MiB"));
const fmt = (v: number) => (props.metric === "time" ? v.toFixed(2) : Math.round(v).toString());
const max = computed(() => Math.max(...pairs.value.flatMap((p) => [p.baseline, p.optimized]), 1));
const step = computed(() => (props.metric === "time" ? 10 : 100));
const axisMax = computed(() => Math.ceil(max.value / step.value) * step.value);
const ticks = computed(() =>
  Array.from({ length: axisMax.value / step.value + 1 }, (_, i) => i * step.value),
);
const pct = (v: number) => `${(v / axisMax.value) * 100}%`;

/* application export, stacked by phase */
const PHASES = [
  { key: "fetch", label: "Fetch records", color: "var(--bc-1)" },
  { key: "commit", label: "Commit XLSX rows", color: "var(--bc-3)" },
  { key: "finalize", label: "Finalize", color: "var(--bc-4)" },
] as const;
const app = computed(() => {
  if (!report) return [];
  return (["baseline", "optimized"] as const).map((v) => {
    const t = report.application.timingsMs[v];
    const segments = PHASES.map((p) => ({ ...p, s: t[p.key] / 1000 }));
    const other = (t.job - t.fetch - t.commit - t.finalize) / 1000;
    return {
      key: v,
      label: v === "baseline" ? report.baseline.version : "current",
      segments,
      other,
      job: t.job / 1000,
    };
  });
});
const appMax = computed(() => Math.ceil(Math.max(...app.value.map((a) => a.job), 1) / 10) * 10);

const hover = ref<string | null>(null);
</script>

<template>
  <figure v-if="report" class="bc not-prose">
    <div class="bc-frame">
      <template v-if="metric !== 'app'">
        <div class="bc-head">
          <span class="bc-title"
            >{{ metric === "time" ? "Total export time" : "Peak memory (RSS)" }}, lower is
            better</span
          >
          <span class="bc-legend">
            <span v-for="s in SERIES" :key="s.key"
              ><i :style="{ background: s.color }" />{{ s.label }}</span
            >
          </span>
        </div>
        <div class="bc-plot">
          <div class="bc-grid" aria-hidden="true">
            <span v-for="t in ticks" :key="t" :style="{ left: pct(t) }" />
          </div>
          <div
            v-for="p in pairs"
            :key="p.label"
            class="bc-row"
            @mouseenter="hover = p.label"
            @mouseleave="hover = null"
          >
            <span class="bc-label">{{ p.label }}</span>
            <div class="bc-bars">
              <div v-for="s in SERIES" :key="s.key" class="bc-bar-line">
                <span class="bc-bar" :style="{ width: pct(p[s.key]), background: s.color }" />
                <span class="bc-val">{{ fmt(p[s.key]) }} {{ unit }}</span>
              </div>
            </div>
            <div v-if="hover === p.label" class="bc-tip" role="status">
              <b>{{ p.label }}</b>
              <span>{{ SERIES[0].label }}: {{ fmt(p.baseline) }} {{ unit }}</span>
              <span>current: {{ fmt(p.optimized) }} {{ unit }}</span>
              <span class="d">{{
                metric === "time"
                  ? `${(p.baseline / p.optimized).toFixed(1)}× faster`
                  : `${Math.round((1 - p.optimized / p.baseline) * 100)}% less memory`
              }}</span>
            </div>
          </div>
          <div class="bc-axis" aria-hidden="true">
            <span v-for="t in ticks" :key="t" :style="{ left: pct(t) }"
              >{{ t }}{{ unit === "s" ? " s" : "" }}</span
            >
          </div>
        </div>
      </template>
      <template v-else>
        <div class="bc-head">
          <span class="bc-title"
            >Real export of {{ report.application.rows.toLocaleString("en-US") }} rows ×
            {{ report.application.columns }} columns, whole job</span
          >
          <span class="bc-legend">
            <span v-for="p in PHASES" :key="p.key"
              ><i :style="{ background: p.color }" />{{ p.label }}</span
            >
          </span>
        </div>
        <div class="bc-plot">
          <div v-for="a in app" :key="a.key" class="bc-row app">
            <span class="bc-label">{{ a.label }}</span>
            <div class="bc-stack">
              <span
                v-for="seg in a.segments"
                :key="seg.key"
                class="seg"
                :style="{ width: `${(seg.s / appMax) * 100}%`, background: seg.color }"
                :title="`${seg.label}: ${seg.s.toFixed(1)} s`"
              />
              <span class="bc-val">{{ a.job.toFixed(1) }} s</span>
            </div>
          </div>
        </div>
      </template>
    </div>
    <figcaption>
      {{
        caption ??
        `${report.hardware.cpu}, ${report.hardware.memoryGiB} GiB, ${report.runtime}. Measured ${report.date}.`
      }}
    </figcaption>
  </figure>
</template>

<style scoped>
.bc {
  margin: 1.75rem 0;
  /* categorical slots validated for both docs surfaces (dataviz palette: blue, green, orange, aqua) */
  --bc-1: #2a78d6;
  --bc-2: #008300;
  --bc-3: #eb6834;
  --bc-4: #1baf7a;
}
:global(.dark) .bc {
  --bc-1: #3987e5;
  --bc-2: #008300;
  --bc-3: #d95926;
  --bc-4: #199e70;
}
.bc-frame {
  padding: 18px 20px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent);
}
.bc-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 20px;
  margin-bottom: 14px;
}
.bc-title {
  font-weight: 650;
  color: var(--ui-text-highlighted);
}
.bc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font: 500 12px/1.4 var(--font-mono);
  color: var(--ui-text-toned);
}
.bc-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bc-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.bc-plot {
  position: relative;
  --label-w: 190px;
}
.bc-grid,
.bc-axis {
  position: absolute;
  left: var(--label-w);
  right: 64px;
}
.bc-grid {
  top: 0;
  bottom: 20px;
}
.bc-grid span {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--ui-border-muted);
}
.bc-row {
  position: relative;
  display: grid;
  grid-template-columns: var(--label-w) minmax(0, 1fr);
  align-items: center;
  padding: 8px 0;
}
.bc-label {
  font-size: 0.86rem;
  color: var(--ui-text-toned);
  padding-right: 12px;
}
.bc-bars {
  position: relative;
  display: grid;
  gap: 3px;
  margin-right: 64px;
}
.bc-bar-line {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 14px;
}
.bc-bar {
  height: 14px;
  border-radius: 0 4px 4px 0;
}
.bc-val {
  font: 500 11.5px/1 var(--font-mono);
  color: var(--ui-text-toned);
  white-space: nowrap;
}
.bc-axis {
  position: relative;
  height: 20px;
  margin-left: var(--label-w);
  left: 0;
  margin-right: 64px;
}
.bc-axis span {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  font: 500 10.5px/1 var(--font-mono);
  color: var(--ui-text-muted);
  white-space: nowrap;
}
.bc-tip {
  position: absolute;
  z-index: 3;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--ui-border-accented);
  border-radius: 6px;
  background: var(--ui-bg);
  box-shadow: 0 12px 30px -16px rgba(0, 0, 0, 0.5);
  font: 500 11.5px/1.4 var(--font-mono);
  color: var(--ui-text);
  pointer-events: none;
}
.bc-tip b {
  font-family: var(--font-sans);
  color: var(--ui-text-highlighted);
}
.bc-tip .d {
  color: var(--ui-primary);
}
.bc-row.app {
  padding: 10px 0;
}
.bc-stack {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
}
.seg {
  height: 18px;
}
.seg:last-of-type {
  border-radius: 0 4px 4px 0;
}
.bc-stack .bc-val {
  margin-left: 8px;
}
figcaption {
  margin: 10px 2px 0;
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}
@media (max-width: 640px) {
  .bc-plot {
    --label-w: 110px;
  }
  .bc-label {
    font-size: 0.78rem;
  }
}
</style>
