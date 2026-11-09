<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { hl, icon, revealOnScroll, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);

const DEALS = [
  {
    account: "Halvorsen Freight",
    owner: "Ama Okafor",
    stage: ["Won", "won"],
    r: { EMEA: 48200, NA: 12400, APAC: 9800, LATAM: 0 },
  },
  {
    account: "Okapi Health",
    owner: "Léa Moreau",
    stage: ["Proposal", "prop"],
    r: { EMEA: 0, NA: 36500, APAC: 4200, LATAM: 7900 },
  },
  {
    account: "Tanaka Robotics",
    owner: "Jonas Lindqvist",
    stage: ["Won", "won"],
    r: { EMEA: 6300, NA: 0, APAC: 58700, LATAM: 0 },
  },
  {
    account: "Quarry Lane Studio",
    owner: "Sami Haddad",
    stage: ["Negotiation", "nego"],
    r: { EMEA: 14100, NA: 22900, APAC: 0, LATAM: 11300 },
  },
  {
    account: "Nordvik Energy",
    owner: "Jonas Lindqvist",
    stage: ["Won", "won"],
    r: { EMEA: 52600, NA: 0, APAC: 0, LATAM: 0 },
  },
  {
    account: "Brightwater Labs",
    owner: "Sami Haddad",
    stage: ["Proposal", "prop"],
    r: { EMEA: 0, NA: 8400, APAC: 0, LATAM: 3100 },
  },
] as const;
type Region = "EMEA" | "NA" | "APAC" | "LATAM";
const ALL_REGIONS: Region[] = ["EMEA", "NA", "APAC", "LATAM"];
const THEMES = {
  forest: { tt: "#0e3b26", th: "#17603d", band: "#eef7f1", sum: "#e3f2e9" },
  slate: { tt: "#1e293b", th: "#334155", band: "#f1f5f9", sum: "#e2e8f0" },
  graphite: { tt: "#18181b", th: "#3f3f46", band: "#f4f4f5", sum: "#e4e4e7" },
} as const;
type ThemeKey = keyof typeof THEMES;
type View = "all" | "finance" | "ops";

const DEFAULTS = {
  view: "all" as View,
  regions: ["EMEA", "NA"] as Region[],
  mode: "report" as "report" | "table",
  theme: "forest" as ThemeKey,
};
const ms = reactive({ ...DEFAULTS, regions: [...DEFAULTS.regions] });
const edits = ref(0);

const tk = (k: string, v: string, html: string, cls = "") =>
  `<button type="button" class="tok ${cls}" data-k="${k}" data-v="${v}">${html}</button>`;
const swap = icon("arrow-left-right", "swap");

const lines = computed(() => {
  const L: Array<{ id: string; html: string }> = [];
  const h = hl;
  L.push({ id: "h1", html: h("const deals = createExcelSchema<Deal, Ctx>({") });
  L.push({
    id: "mode",
    html: `  ${h("mode:")} ${tk("mode", "", `<span class="t-str">"${ms.mode === "table" ? "excel-table" : "report"}"</span>${swap}`)},`,
  });
  L.push({ id: "h2", html: h("})") });
  L.push({ id: "c1", html: h('  .column("account", { accessor: "account" })') });
  L.push({ id: "c2", html: h('  .column("owner", { accessor: "owner.name" })') });
  L.push({ id: "c3", html: h('  .column("stage", { type: "badge", accessor: "stage" })') });
  L.push({ id: "d1", html: h('  .dynamic("regions", (b, { ctx }) =>') });
  L.push({ id: "d2", html: h("    ctx.regions.forEach((r) =>") });
  L.push({ id: "d3", html: h("      b.column(r, { accessor: (d) => d.byRegion[r] })))") });
  L.push({ id: "t1", html: h('  .column("total", {') });
  L.push({ id: "t2", html: h('    accessor: "total",') });
  L.push({
    id: "t3",
    html: h(
      ms.mode === "table"
        ? '    totalsRow: { function: "sum" },'
        : '    summary: (s) => [s.formula("sum")],',
    ),
  });
  L.push({ id: "t4", html: h("  })") });
  L.push({ id: "b", html: h("  .build()") });
  L.push({ id: "sp", html: " " });
  L.push({ id: "w1", html: h('workbook.sheet("Deals").table("deals", {') });
  L.push({ id: "w2", html: h('  title: "Q3 deals by region",') });
  L.push({ id: "w3", html: h("  rows, schema: deals,") });
  const regs = ALL_REGIONS.map((r) =>
    tk("region", r, `<span class="t-str">"${r}"</span>`, ms.regions.includes(r) ? "" : "off"),
  ).join(", ");
  L.push({ id: "ctx", html: `  ${h("context: { regions: [")}${regs}${h("] },")}` });
  const segs = (
    [
      ["all", "All"],
      ["finance", "Finance"],
      ["ops", "Ops"],
    ] as const
  )
    .map(([v, l]) => tk("view", v, l, "seg" + (ms.view === v ? " on" : "")))
    .join(" ");
  L.push({ id: "aud", html: `  <span class="t-com">// audience</span> ${segs}` });
  if (ms.view === "finance")
    L.push({ id: "sel", html: h('  select: { exclude: ["owner", "stage"] },') });
  else if (ms.view === "ops")
    L.push({ id: "sel", html: h('  select: { include: ["account", "owner", "stage"] },') });
  else L.push({ id: "sel", html: '<span class="t-com">  // no select: every column ships</span>' });
  if (ms.mode === "table") L.push({ id: "af", html: h("  autoFilter: true,") });
  L.push({
    id: "theme",
    html: `  ${h("theme:")} ${tk("theme", "", `<span class="sw" style="background:${THEMES[ms.theme].th}"></span>${ms.theme}${swap}`)},`,
  });
  L.push({ id: "end", html: h("})") });
  return L;
});

/* lines that changed since the last render flash once */
const changed = ref(new Set<string>());
let prevSig: Set<string> | null = null;
watch(
  lines,
  (next) => {
    const sig = new Set(next.map((l) => l.id + l.html));
    changed.value = prevSig
      ? new Set(next.filter((l) => !prevSig!.has(l.id + l.html)).map((l) => l.id))
      : new Set();
    prevSig = sig;
  },
  { immediate: true },
);

type Col = { id: string; h: string; w: string; num?: boolean };
const cols = computed<Col[]>(() => {
  let c: Col[] = [
    { id: "account", h: "Account", w: "1.6fr" },
    { id: "owner", h: "Owner", w: "1.3fr" },
    { id: "stage", h: "Stage", w: "1.05fr" },
    ...ms.regions.map((r) => ({ id: r, h: r, num: true, w: ".9fr" })),
    { id: "total", h: "Total", num: true, w: "1fr" },
  ];
  if (ms.view === "finance") c = c.filter((x) => x.id !== "owner" && x.id !== "stage");
  if (ms.view === "ops") c = c.filter((x) => ["account", "owner", "stage"].includes(x.id));
  return c;
});
const prevCols = ref<string[]>([]);
const freshCols = ref(new Set<string>());
watch(
  cols,
  (next, old) => {
    const before = new Set((old ?? next).map((c) => c.id));
    freshCols.value = new Set(next.filter((c) => !before.has(c.id)).map((c) => c.id));
    prevCols.value = next.map((c) => c.id);
  },
  { immediate: true },
);
const table = computed(() => ms.mode === "table");
const hasNum = computed(() => cols.value.some((c) => c.num));
const nRows = computed(() => (hasNum.value ? 9 : 8));
const totIdx = computed(() => cols.value.findIndex((c) => c.id === "total"));
const LET = "ABCDEFGHIJ";
const val = (d: (typeof DEALS)[number], c: Col): string | number => {
  if (c.id === "account") return d.account;
  if (c.id === "owner") return d.owner;
  if (c.id === "stage") return d.stage[0];
  if (c.id === "total")
    return Object.values(d.r as Record<Region, number>).reduce((a, b) => a + b, 0);
  return d.r[c.id as Region];
};
const usd0 = (v: number) => "$" + v.toLocaleString("en-US");
const fmt = (v: string | number) => (typeof v === "number" ? usd0(v) : v);
const colTotal = (c: Col) => DEALS.reduce((s, d) => s + (val(d, c) as number), 0);
const sheetStyle = computed(() => {
  const th = THEMES[ms.theme];
  return { "--tt": th.tt, "--th": th.th, "--band": th.band, "--sum": th.sum };
});
const gridStyle = computed(() => ({
  gridTemplateColumns: "30px " + cols.value.map((c) => `minmax(0,${c.w})`).join(" "),
  gridTemplateRows: "22px 34px 32px",
  gridAutoRows: "36px",
}));
const refCell = computed(() =>
  hasNum.value && totIdx.value > -1 ? LET[totIdx.value] + "9" : "B4",
);
const refVal = computed(() => {
  if (!(hasNum.value && totIdx.value > -1)) return "Léa Moreau";
  const L1 = LET[totIdx.value];
  return table.value ? "=SUBTOTAL(109,[Total])" : `=SUM(${L1}3:${L1}8)`;
});
const meta = computed(
  () =>
    `${cols.value.length} columns, ${table.value ? "native Excel table" : "report"}, ${ms.theme}`,
);
const FILL_ROWS = 16;

function onCodeClick(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest<HTMLElement>(".tok");
  if (!t) return;
  const k = t.dataset.k;
  const v = t.dataset.v as string;
  if (k === "mode") ms.mode = ms.mode === "report" ? "table" : "report";
  if (k === "view") ms.view = v as View;
  if (k === "theme") {
    const keys = Object.keys(THEMES) as ThemeKey[];
    ms.theme = keys[(keys.indexOf(ms.theme) + 1) % keys.length]!;
  }
  if (k === "region") {
    const r = v as Region;
    ms.regions = ms.regions.includes(r)
      ? ms.regions.filter((x) => x !== r)
      : ALL_REGIONS.filter((x) => x === r || ms.regions.includes(x));
  }
  edits.value++;
}
function reset() {
  Object.assign(ms, { ...DEFAULTS, regions: [...DEFAULTS.regions] });
  edits.value = 0;
}
/* restart the flash animation on lines that changed again */
const codeKey = ref(0);
watch(changed, () => nextTick(() => codeKey.value++));

useWidget(root, (s) => revealOnScroll(s));
</script>

<template>
  <section id="modular" ref="root" class="sec">
    <div class="wrap">
      <h2 class="h2 reveal">One schema.<br /><span class="accent">Every report.</span></h2>
      <p class="lede reveal">
        Pick columns per audience, generate columns from runtime data, switch to a native Excel
        table, change the theme. The schema stays one file.
      </p>
      <div class="mod2">
        <div class="mcode">
          <div class="ct">
            <span class="hint"
              ><UIcon name="i-lucide-mouse-pointer-click" class="ic" />Click the highlighted
              values</span
            >
            <span class="r"
              ><span>{{ edits }} edit{{ edits === 1 ? "" : "s" }}</span
              ><button type="button" @click="reset">
                <UIcon name="i-lucide-rotate-ccw" class="ic" />Reset
              </button></span
            >
          </div>
          <pre :key="codeKey" @click="onCodeClick"><span
            v-for="l in lines"
            :key="l.id"
            class="l"
            :class="{ chg: changed.has(l.id) }"
            v-html="l.html"
          /></pre>
        </div>
        <div class="mright">
          <div class="spec msheet" :style="sheetStyle">
            <div class="sfbar">
              <span class="ref">{{ refCell }}</span
              ><span class="fxs">fx</span><span class="val">{{ refVal }}</span>
            </div>
            <div class="sgrid" :style="gridStyle">
              <div class="s lt" />
              <div
                v-for="(c, i) in cols"
                :key="'lt' + c.id"
                class="s lt"
                :class="{ newcol: freshCols.has(c.id) }"
              >
                {{ LET[i] }}
              </div>
              <div
                v-for="r in nRows"
                :key="'rn' + r"
                class="s rn"
                :style="{ gridRow: r + 1, gridColumn: 1 }"
              >
                {{ r }}
              </div>
              <div class="s title" style="grid-row: 2">Q3 deals by region</div>
              <div
                v-for="(c, i) in cols"
                :key="'hd' + c.id"
                class="s hd"
                :class="{ r: c.num, newcol: freshCols.has(c.id) }"
                :style="{ gridRow: 3, gridColumn: i + 2 }"
              >
                <span class="ht">{{ c.h }}</span
                ><span v-if="table" class="fbtn" v-html="icon('chevron-down')" />
              </div>
              <template v-for="(d, k) in DEALS" :key="d.account">
                <div
                  v-for="(c, i) in cols"
                  :key="d.account + c.id"
                  class="s"
                  :class="[
                    c.id === 'stage' ? `badge ${d.stage[1]}` : c.num ? 'r' : '',
                    { band: table && k % 2 === 1, newcol: freshCols.has(c.id) },
                  ]"
                  :style="{ gridRow: k + 4, gridColumn: i + 2 }"
                >
                  {{ fmt(val(d, c)) }}
                </div>
              </template>
              <template v-if="hasNum">
                <div
                  v-for="(c, i) in cols"
                  :key="'ft' + c.id"
                  class="s ft"
                  :class="{ r: c.num, selc: i === totIdx, newcol: freshCols.has(c.id) }"
                  :style="{ gridRow: 10, gridColumn: i + 2 }"
                >
                  {{ i === 0 ? (table ? "Total" : "TOTAL") : c.num ? usd0(colTotal(c)) : "" }}
                </div>
              </template>
              <!-- empty worksheet rows below the table; the grid clips them at the window height -->
              <template v-for="r in FILL_ROWS" :key="'f' + r">
                <div class="s rn fill" :style="{ gridRow: nRows + r + 1, gridColumn: 1 }">
                  {{ nRows + r }}
                </div>
                <div
                  v-for="(c, i) in cols"
                  :key="'f' + r + c.id"
                  class="s fill"
                  :style="{ gridRow: nRows + r + 1, gridColumn: i + 2 }"
                />
              </template>
            </div>
            <div class="stabs"><span class="on">Deals</span><span>Notes</span><span>+</span></div>
          </div>
          <div class="mcap">
            <span>Rendered from <b>deals.report.ts</b></span
            ><span>{{ meta }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
