<script setup lang="ts">
import { ref } from "vue";
import { hl, icon, prefersReducedMotion, revealOnScroll, useWidget } from "./bp";

/**
 * "Rows in. Pivots and charts out." A typed chain from a table to a pivot table to a pivot
 * chart. The stage is drawn at a fixed 760x470 and scaled to fit; narrow
 * screens see half of it at a readable size, with a camera that pans from the table to the pivot.
 */
const root = ref<HTMLElement | null>(null);

const CODE = [
  "createWorkbook()",
  '  .sheet("Orders")',
  '  .table("orders", { schema: orders, rows })',
  '  .sheet("Pivot")',
  '  .pivot("byRegion", ({ refs }) =>',
  '    refs.sheet("Orders").table("orders").pivot({',
  '      rows: ["region"],',
  '      columns: ["half"],',
  "      @@VALUES@@",
  "    }),",
  "  )",
  '  .chart("byRegionChart", ({ refs }) => ({',
  "    marks: [",
  '      refs.pivot("byRegion").bar({ stack: true }),',
  "    ],",
  "  }));",
];
const LINES = CODE.map((line, i) =>
  line.includes("@@VALUES@@")
    ? { i, pre: hl("      values: { "), post: hl(': "sum" },') }
    : { i, html: hl(line || " ") },
);
const BEATS: Record<number, [number, number]> = { 1: [0, 2], 2: [3, 10], 3: [11, 15] };

const STEPS = [
  { b: "Table", t: "Twelve orders on their own sheet, typed by their schema." },
  {
    b: "Pivot table",
    t: "Revenue summed by region and half. Summing a text column won't compile.",
  },
  { b: "Pivot chart", t: "A native chart drawn from the pivot. Excel keeps all three in sync." },
];
const POINTS = [
  { ic: "i-lucide-chart-column", t: "bar · line · area · scatter · pie · doughnut" },
  { ic: "i-lucide-layers", t: "combos with a secondary axis" },
  { ic: "i-lucide-layout-grid", t: "charts across sheets" },
  { ic: "i-lucide-waves", t: "streamed workbooks too" },
  { ic: "i-lucide-refresh-cw", t: "pivots refresh when Excel opens the file" },
];

type Order = [id: string, region: string, half: string, revenue: number];
const ORD: Order[] = [
  ["#1001", "EMEA", "H1", 412],
  ["#1002", "Americas", "H1", 520],
  ["#1003", "APAC", "H1", 261],
  ["#1004", "EMEA", "H2", 498],
  ["#1005", "Americas", "H2", 612],
  ["#1006", "APAC", "H2", 336],
  ["#1007", "EMEA", "H1", 380],
  ["#1008", "Americas", "H1", 545],
  ["#1009", "APAC", "H1", 288],
  ["#1010", "EMEA", "H2", 456],
  ["#1011", "Americas", "H2", 590],
  ["#1012", "APAC", "H2", 302],
];
const REG = ["EMEA", "Americas", "APAC"];
const HALF = ["H1", "H2"];
const kf = (n: number) => n.toLocaleString("en-US") + "k";
const SUM = REG.map((r) =>
  HALF.map((h) => ORD.filter((o) => o[1] === r && o[2] === h).reduce((s, o) => s + o[3], 0)),
);
/** Orders per (region, half): the first one carries the sum, the second merges into it. */
const PAIRS: Record<string, number[]> = {};
ORD.forEach((o, i) => (PAIRS[o[1] + o[2]] ||= []).push(i));

type Box = { x: number; y: number; w: number; h: number };
const K = 205 / 2400;
const boxStyle = (r: Box) => `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
const revBox = (i: number): Box => ({ x: 224, y: 52 + 25 * i, w: 116, h: 25 });
const pivBox = (r: number, h: number): Box => ({ x: h ? 590 : 510, y: 54 + 30 * r, w: 80, h: 30 });
const barBox = (r: number, h: number): Box => {
  const cx = 420 + (320 / 3) * (r + 0.5);
  const h1 = SUM[r]![0]! * K;
  const h2 = SUM[r]![1]! * K;
  return h
    ? { x: cx - 29, y: 432 - h1 - h2, w: 58, h: h2 }
    : { x: cx - 29, y: 432 - h1, w: 58, h: h1 };
};

/** The whole stage as one HTML string: it is positioned absolutely and animated imperatively. */
function stageHtml() {
  const cell = (r: Box, txt: string | number, cls = "", data = "") =>
    `<div class="nx2-cell ${cls}"${data ? ` data-k="${data}"` : ""} style="${boxStyle(r)}">${txt}</div>`;
  let h = `<svg class="nx2-links" viewBox="0 0 760 470"><path data-k="l1" d="M340 196 C 366 196, 364 96, 390 96"/><text data-k="t1" x="346" y="128">pivot</text><path data-k="l2" d="M575 176 C 575 186, 575 188, 575 198"/></svg>`;
  h += `<div class="nx2-card" style="${boxStyle({ x: 0, y: 26, w: 340, h: 326 })}"><div class="tab">${icon("table")}Orders<em>12 rows</em></div></div>`;
  h += `<div class="nx2-card piv" style="${boxStyle({ x: 390, y: 26, w: 370, h: 444 })}"><div class="tab">${icon("chart-column")}Pivot<em>pivot table · pivot chart</em></div><div class="nx2-empty"><span class="w">empty sheet</span><span class="e"><b>TS2322</b> nothing is written</span></div></div>`;
  (
    [
      [0, 74, "Order"],
      [74, 96, "Region"],
      [170, 54, "Half"],
      [224, 116, "Revenue"],
    ] as const
  ).forEach(
    ([x, w, t], i) =>
      (h += cell({ x, y: 26, w, h: 26 }, t, "h" + (i === 3 ? " n" : ""), i === 1 ? "hreg" : "")),
  );
  ORD.forEach((o, i) => {
    const y = 52 + 25 * i;
    h +=
      cell({ x: 0, y, w: 74, h: 25 }, o[0]) +
      cell({ x: 74, y, w: 96, h: 25 }, o[1], "reg") +
      cell({ x: 170, y, w: 54, h: 25 }, o[2]) +
      cell(revBox(i), kf(o[3]), "n rev");
  });
  h += `<div class="nx2-layer" data-k="pivot"><div class="nx2-pbg" style="${boxStyle({ x: 390, y: 26, w: 370, h: 150 })}"></div>`;
  h +=
    cell({ x: 390, y: 26, w: 120, h: 28 }, "region &#9662;", "h") +
    cell({ x: 510, y: 26, w: 80, h: 28 }, "H1", "h n") +
    cell({ x: 590, y: 26, w: 80, h: 28 }, "H2", "h n") +
    cell({ x: 670, y: 26, w: 90, h: 28 }, "Total", "h n");
  REG.forEach((r, i) => {
    h +=
      cell({ x: 390, y: 54 + 30 * i, w: 120, h: 30 }, r, "lbl") +
      cell(pivBox(i, 0), "", "n") +
      cell(pivBox(i, 1), "", "n") +
      cell({ x: 670, y: 54 + 30 * i, w: 90, h: 30 }, "", "n", "tr" + i);
  });
  h +=
    cell({ x: 390, y: 144, w: 120, h: 32 }, "Grand total", "gt") +
    cell({ x: 510, y: 144, w: 80, h: 32 }, "", "gt n", "tc0") +
    cell({ x: 590, y: 144, w: 80, h: 32 }, "", "gt n", "tc1") +
    cell({ x: 670, y: 144, w: 90, h: 32 }, "", "gt n", "tg");
  h += `</div><div class="nx2-layer" data-k="chart"><svg viewBox="0 0 760 470" width="760" height="470" style="position:absolute;left:0;top:0;overflow:visible"><rect x="391" y="176" width="368" height="293" fill="#fbfdfc"/>`;
  h += `<text x="410" y="214" font-size="12.5" font-weight="700" fill="#13241a">Revenue by region</text>`;
  h += `<rect x="622" y="204" width="11" height="11" fill="#17603d"/><text x="638" y="214" font-size="11.5" fill="#3b5a49">H1</text><rect x="666" y="204" width="11" height="11" fill="#6cc495"/><text x="682" y="214" font-size="11.5" fill="#3b5a49">H2</text>`;
  for (let v = 0; v <= 2400; v += 600) {
    const y = 432 - v * K;
    h += `<line x1="436" x2="742" y1="${y}" y2="${y}" stroke="#e5ece8"/><text x="430" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#6e8277">${v ? v / 1000 + "M" : "0"}</text>`;
  }
  h += `<line x1="436" x2="742" y1="432" y2="432" stroke="#94a89c"/>`;
  REG.forEach(
    (r, i) =>
      (h += `<text x="${420 + (320 / 3) * (i + 0.5)}" y="452" text-anchor="middle" font-size="11.5" fill="#3b5a49">${r}</text>`),
  );
  h += `</svg></div>`;
  ORD.forEach(
    (o, i) =>
      (h += `<div class="nx2-chip" data-c="${i}" style="${boxStyle(revBox(i))}">${kf(o[3])}</div>`),
  );
  REG.forEach((_, i) =>
    HALF.forEach(
      (_h, j) =>
        (h += `<div class="nx2-bar" data-b="${i}${j}" style="${boxStyle(pivBox(i, j))};background:${j ? "#6cc495" : "#17603d"};color:${j ? "#0f3d24" : "#fff"}">${kf(SUM[i]![j]!)}</div>`),
    ),
  );
  return h;
}
const STAGE = stageHtml();
const DUR: Record<number, number> = { 1: 2600, 2: 8200, 3: 5600 };

useWidget(root, (s) => {
  revealOnScroll(s);
  const reduce = prefersReducedMotion();
  const fit = s.$(".nx2-fit");
  const stage = s.$(".nx2-stage");
  const k = (key: string) => s.$(`.nx2-stage [data-k="${key}"]`);
  const chip = (i: number) => s.$(`.nx2-stage [data-c="${i}"]`);
  const barEl = (i: number, j: number) => s.$(`.nx2-stage [data-b="${i}${j}"]`);
  const tok = s.$(".nx2-tok");
  const caret = s.$(".nx2-caret");
  const empty = s.$(".nx2-empty");
  const place = (el: HTMLElement, r: Box) =>
    Object.assign(el.style, {
      left: r.x + "px",
      top: r.y + "px",
      width: r.w + "px",
      height: r.h + "px",
    });

  let camOn = false;
  function fitStage() {
    const w = fit.clientWidth;
    const narrow = w < 640;
    const scale = narrow ? Math.min(1, w / 388) : Math.min(1.08, w / 760);
    stage.style.transform = `scale(${scale}) translateX(${narrow && camOn ? -386 : 0}px)`;
    fit.style.height = 470 * scale + "px";
    fit.classList.toggle("narrow", narrow);
  }
  const cam = (on: boolean) => {
    camOn = on;
    fitStage();
  };

  function lines(n: number) {
    const [a, b] = BEATS[n] ?? [0, 99];
    s.$$(".nx2-code .l").forEach((l, i) =>
      l.classList.toggle("act", n > 0 && n < 4 && i >= a && i <= b),
    );
  }
  function tip(on: boolean) {
    const t = s.$(".nx2-tip");
    const line = tok.closest<HTMLElement>(".l")!;
    t.style.top = line.offsetTop + line.offsetHeight + 6 + "px";
    t.classList.toggle("on", on);
    tok.classList.toggle("bad", on);
    s.$$(".nx2-stage .reg").forEach((c) => c.classList.toggle("bad", on));
    k("hreg").classList.toggle("bad", on);
    empty.classList.toggle("err", on);
  }
  function totals(on: boolean) {
    REG.forEach((_, i) => (k("tr" + i).textContent = on ? kf(SUM[i]![0]! + SUM[i]![1]!) : ""));
    [0, 1].forEach(
      (j) => (k("tc" + j).textContent = on ? kf(SUM.reduce((acc, r) => acc + r[j]!, 0)) : ""),
    );
    k("tg").textContent = on ? kf(SUM.flat().reduce((a, b) => a + b, 0)) : "";
  }
  function instant(fn: () => void) {
    stage.classList.add("nx2-instant");
    fn();
    void stage.offsetWidth;
    stage.classList.remove("nx2-instant");
  }
  /** Static end state of beat n (1..3), or the frozen type-error frame. */
  function setState(n: number | "error") {
    const beat = n === "error" ? 1 : n;
    instant(() => {
      cam(beat >= 2);
      ORD.forEach((o, i) => {
        const el = chip(i);
        const pair = PAIRS[o[1] + o[2]]!;
        const r = REG.indexOf(o[1]);
        const j = HALF.indexOf(o[2]);
        el.classList.remove("fly", "gone", "sum");
        if (beat >= 2) {
          place(el, pivBox(r, j));
          if (pair[0] === i) {
            el.textContent = kf(SUM[r]![j]!);
            el.classList.add("sum");
          } else el.classList.add("gone");
        } else {
          place(el, revBox(i));
          el.textContent = kf(o[3]);
        }
      });
      REG.forEach((_, i) =>
        [0, 1].forEach((j) => {
          const b = barEl(i, j);
          place(b, beat >= 3 ? barBox(i, j) : pivBox(i, j));
          b.classList.toggle("on", beat >= 3);
        }),
      );
    });
    k("pivot").classList.toggle("on", beat >= 2);
    empty.classList.toggle("off", beat >= 2);
    k("chart").classList.toggle("on", beat >= 3);
    k("l1").classList.toggle("on", beat >= 2);
    k("t1").classList.toggle("on", beat >= 2);
    k("l2").classList.toggle("on", beat >= 3);
    totals(beat >= 2);
    s.$$(".nx2-stage .rev").forEach((c) => c.classList.remove("good"));
    tok.textContent = n === "error" ? "region" : "revenue";
    tip(n === "error");
    lines(n === "error" ? 2 : n === 3 ? 4 : n);
    railState(n === "error" ? 2 : n, n === "error");
  }
  function railState(n: number, current: boolean) {
    s.$$(".nx2-steps li").forEach((li) => {
      const st = Number(li.dataset.s);
      li.classList.toggle("done", st < n || (!current && st === n));
      li.classList.toggle("on", current && st === n);
      li.style.setProperty("--w", current && st === n ? "50%" : "100%");
      li.style.removeProperty("--dur");
    });
  }
  function rail(n: number, dur: number) {
    s.$$(".nx2-steps li").forEach((li) => {
      li.classList.toggle("done", Number(li.dataset.s) < n);
      li.classList.remove("on");
      li.style.removeProperty("--w");
      li.style.removeProperty("--dur");
    });
    const li = s.$(`.nx2-steps li[data-s="${n}"]`);
    li.style.setProperty("--w", "0%");
    li.classList.add("on");
    void li.offsetWidth;
    li.style.setProperty("--dur", dur + "ms");
    li.style.setProperty("--w", "100%");
  }

  let gen = 0;
  let auto = !reduce;
  let visible = false;
  // Read through functions: the loop awaits, so these flags change between iterations.
  const isVisible = () => visible;
  const isAuto = () => auto;

  async function play(n: number, g: number) {
    const alive = () => g === gen && !s.dead;
    const t0 = performance.now();
    rail(n, DUR[n]!);
    if (n === 1) {
      setState(1);
      rail(1, DUR[1]!);
      s.$$(".nx2-stage .rev").forEach((c) => c.classList.add("good"));
      await s.wait(900);
      s.$$(".nx2-stage .rev").forEach((c) => c.classList.remove("good"));
    } else if (n === 2) {
      lines(2);
      cam(false);
      caret.style.display = "";
      const retype = async (word: string) => {
        while (tok.textContent && alive()) {
          tok.textContent = tok.textContent.slice(0, -1);
          await s.wait(40);
        }
        for (const ch of word) {
          if (!alive()) return;
          tok.textContent += ch;
          await s.wait(80);
        }
      };
      await retype("region");
      await s.wait(250);
      if (!alive()) return;
      tip(true);
      s.$$(".nx2-stage .reg").forEach((c) => {
        c.classList.remove("nx2-shake");
        void c.offsetWidth;
        c.classList.add("nx2-shake");
      });
      await s.wait(1700);
      if (!alive()) return;
      tip(false);
      await retype("revenue");
      if (!alive()) return;
      caret.style.display = "none";
      s.$$(".nx2-stage .rev").forEach((c) => c.classList.add("good"));
      k("pivot").classList.add("on");
      empty.classList.add("off");
      k("l1").classList.add("on");
      k("t1").classList.add("on");
      await s.wait(450);
      if (!alive()) return;
      s.timeout(() => alive() && cam(true), 500);
      await Promise.all(
        ORD.map((o, i) =>
          s.wait(i * 95).then(async () => {
            if (!alive()) return;
            const el = chip(i);
            const r = REG.indexOf(o[1]);
            const j = HALF.indexOf(o[2]);
            const pair = PAIRS[o[1] + o[2]]!;
            el.classList.add("fly");
            place(el, pivBox(r, j));
            await s.wait(880);
            if (!alive()) return;
            el.classList.remove("fly");
            if (pair[1] === i) {
              el.classList.add("gone");
              const holder = chip(pair[0]!);
              holder.classList.add("sum");
              const from = ORD[pair[0]!]![3];
              const to = SUM[r]![j]!;
              const s0 = performance.now();
              await new Promise<void>((res) => {
                const f = (t: number) => {
                  if (s.dead) return;
                  const p = Math.min(1, (t - s0) / 600);
                  holder.textContent = kf(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
                  if (p < 1) requestAnimationFrame(f);
                  else res();
                };
                requestAnimationFrame(f);
              });
            }
          }),
        ),
      );
      if (!alive()) return;
      s.$$(".nx2-stage .rev").forEach((c) => c.classList.remove("good"));
      totals(true);
    } else if (n === 3) {
      lines(3);
      cam(true);
      k("chart").classList.add("on");
      k("l2").classList.add("on");
      await s.wait(350);
      await Promise.all(
        REG.flatMap((_, i) =>
          [0, 1].map((j) =>
            s.wait((i * 2 + j) * 130).then(() => {
              if (!alive()) return;
              const b = barEl(i, j);
              b.classList.add("on");
              void b.offsetWidth;
              place(b, barBox(i, j));
            }),
          ),
        ),
      );
      await s.wait(900);
      if (!alive()) return;
      lines(4);
    }
    const left = DUR[n]! - (performance.now() - t0);
    if (left > 0) await s.wait(left);
  }

  async function loop() {
    while (!s.dead) {
      for (let n = 1; n <= 3; n++) {
        while (!isVisible() && isAuto() && !s.dead) await s.wait(300);
        if (!isAuto() || s.dead) return;
        const g = gen;
        await play(n, g);
        if (g !== gen || !isAuto()) return;
      }
      await s.wait(1200);
    }
  }

  s.on(s.$(".nx2-steps"), "click", (e: MouseEvent) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("li");
    if (!li) return;
    const n = Number(li.dataset.s);
    auto = false;
    const g = ++gen;
    setState(Math.max(1, n - 1));
    void play(n, g);
  });
  const ro = new ResizeObserver(fitStage);
  ro.observe(fit);
  s.track(() => ro.disconnect());
  s.observe(fit, ([en]) => (visible = !!en?.isIntersecting), { threshold: 0.3 });

  fitStage();
  setState(reduce ? 3 : 1);
  if (auto) void loop();
});
</script>

<template>
  <section id="charts" ref="root" class="sec">
    <div class="wrap">
      <div class="nx-eyebrow reveal"><span class="nx-dot" />New in 4.3</div>
      <h2 class="h2 reveal">
        Rows in. Pivots and charts out.<br /><span class="accent">One typed chain.</span>
      </h2>
      <p class="lede reveal">
        Pivot tables and charts are declared from the tables your workbook already has, and Excel
        gets native objects it keeps in sync. TypeScript checks every field on the way: only numbers
        can be summed or plotted.
      </p>
      <div class="nx2">
        <div class="mcode">
          <div class="ct"><span>workbook.ts</span><span class="r">typed-xlsx 4.3</span></div>
          <pre
            class="nx2-code"
          ><template v-for="l in LINES" :key="l.i"><span v-if="l.html !== undefined" class="l" v-html="l.html" /><span v-else class="l"><span v-html="l.pre" /><span class="tok nx2-tok">revenue</span><span class="caret nx2-caret" style="display: none" /><span v-html="l.post" /></span></template></pre>
          <div class="nx2-tip">
            <b>TS2322</b> <code>"region"</code> holds text. Only number columns can be summed, such
            as <code>"revenue"</code>.
          </div>
        </div>
        <div class="nx2-fit"><div class="nx2-stage" v-html="STAGE" /></div>
      </div>
      <ol class="bw-steps three nx2-steps">
        <li v-for="(st, i) in STEPS" :key="st.b" :data-s="i + 1">
          <b>{{ st.b }}</b
          ><span>{{ st.t }}</span>
        </li>
      </ol>
      <div class="nx-points reveal">
        <span v-for="p in POINTS" :key="p.t"><UIcon :name="p.ic" class="ic" />{{ p.t }}</span>
      </div>
      <p class="nx-note reveal">
        <NuxtLink to="/charts/overview">Read the charts guide</NuxtLink> or open the
        <NuxtLink to="/playground/revenue-review">revenue review</NuxtLink>, built with both.
      </p>
    </div>
  </section>
</template>
