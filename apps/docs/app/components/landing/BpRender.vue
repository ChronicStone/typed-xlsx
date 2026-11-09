<script setup lang="ts">
import { ref } from "vue";
import { hl, icon, prefersReducedMotion, revealOnScroll, spark, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);

const FEATURES = [
  {
    g: "STRUCTURE",
    id: "groups",
    name: "Grouped headers",
    reg: [1, 1, 13, 1],
    cell: "I1",
    fx: "Usage %",
    code: `.group("usage", { header: "Usage %" }, (g) =>\n  g.column("jul", { accessor: "usage.jul" })\n   .column("aug", { accessor: "usage.aug" })\n   .column("sep", { accessor: "usage.sep" }))`,
  },
  {
    g: "STRUCTURE",
    id: "freeze",
    name: "Freeze panes",
    reg: [1, 1, 2, 2],
    cell: "C3",
    fx: "Ama Okafor",
    code: `workbook.sheet("Renewals", {\n  freezePane: { rows: 2, columns: 2 },\n})`,
  },
  {
    g: "STRUCTURE",
    id: "subrows",
    name: "Sub-row expansion",
    reg: [1, 5, 13, 6],
    cell: "D6",
    fx: "Analytics add-on",
    code: `.column("plan", {\n  accessor: (row) => row.lines.map((l) => l.plan),\n})\n// one account, two physical rows`,
  },
  {
    g: "STRUCTURE",
    id: "summary",
    name: "Summary rows",
    reg: [1, 10, 13, 10],
    cell: "G10",
    fx: "=SUM(G3:G9)",
    code: `.column("arr", {\n  accessor: "arr",\n  summary: (s) => [s.formula("sum")],\n})`,
  },
  {
    g: "DATA",
    id: "accessors",
    name: "Typed accessors",
    reg: [3, 3, 3, 9],
    cell: "C4",
    fx: "Léa Moreau",
    code: `.column("owner", {\n  accessor: "owner.name", // checked against Account\n})`,
  },
  {
    g: "DATA",
    id: "formulas",
    name: "Formula columns",
    reg: [8, 3, 8, 9],
    cell: "H3",
    fx: "=G3-F3",
    code: `.column("delta", {\n  formula: ({ refs }) =>\n    refs.column("arr").sub(refs.column("priorArr")),\n})`,
  },
  {
    g: "DATA",
    id: "numfmt",
    name: "Number formats",
    reg: [6, 3, 7, 9],
    cell: "G3",
    fx: "184000",
    code: `.column("arr", {\n  accessor: "arr",\n  style: { numFmt: '"$"#,##0' },\n})`,
  },
  {
    g: "DATA",
    id: "validation",
    name: "Data validation",
    reg: [4, 3, 4, 9],
    cell: "D4",
    fx: "Growth",
    code: `validation: (v) =>\n  v.list(["Starter", "Growth", "Enterprise"])\n   .error({ title: "Unknown plan" })`,
  },
  {
    g: "DATA",
    id: "protection",
    name: "Cell protection",
    reg: [8, 3, 8, 9],
    cell: "H4",
    fx: "=G4-F4",
    code: `style: { protection: { locked: true } }\n// sheet option: protection: { password }`,
  },
  {
    g: "VISUALS",
    id: "badges",
    name: "Badges",
    reg: [5, 3, 5, 9],
    cell: "E4",
    fx: "At risk",
    code: `.column("status", {\n  type: "badge",\n  accessor: "status",\n  variants: { Renewed: ok, "At risk": warn },\n})`,
  },
  {
    g: "VISUALS",
    id: "sparklines",
    name: "Sparklines",
    reg: [12, 3, 12, 9],
    cell: "L5",
    fx: "Line sparkline: I5:K5",
    code: `.column("trend", {\n  type: "sparkline",\n  source: { group: "usage" },\n  sparklineType: "line",\n})`,
  },
  {
    g: "VISUALS",
    id: "images",
    name: "Images",
    reg: [1, 3, 1, 9],
    cell: "A3",
    fx: "Picture: halvorsen.png",
    code: `.column("logo", {\n  type: "image",\n  accessor: "logo",\n  size: { width: 20, height: 20 },\n})`,
  },
  {
    g: "VISUALS",
    id: "checkboxes",
    name: "Checkboxes",
    reg: [13, 3, 13, 9],
    cell: "M3",
    fx: "TRUE",
    code: `.column("signed", {\n  type: "checkbox",\n  accessor: "signed",\n})`,
  },
  {
    g: "VISUALS",
    id: "links",
    name: "Hyperlinks",
    reg: [2, 3, 2, 9],
    cell: "B3",
    fx: "Halvorsen Freight",
    code: `.column("account", {\n  type: "hyperlink",\n  accessor: "name",\n  target: (row) => row.crmUrl,\n})`,
  },
  {
    g: "VISUALS",
    id: "conditional",
    name: "Conditional styles",
    reg: [8, 3, 8, 9],
    cell: "H9",
    fx: "=G9-F9",
    code: `conditionalStyle: (c) =>\n  c.when(({ refs }) => refs.column("delta").lt(0), {\n    font: { color: { rgb: "B42318" } },\n  })`,
  },
] as const;
const GROUPS = [...new Set(FEATURES.map((f) => f.g))].map((g) => ({
  g,
  items: FEATURES.map((f, i) => ({ ...f, i })).filter((f) => f.g === g),
}));

const featIdx = ref(9);
const refText = ref<string>(FEATURES[9].cell);
const valText = ref<string>(FEATURES[9].fx);

/* ---------- the renewals specimen sheet ---------- */
const S_COLS = [28, 34, 136, 106, 116, 86, 80, 80, 82, 38, 38, 38, 70, 52];
const S_ROWS = [20, 26, 30, 32, 32, 32, 32, 32, 32, 32, 32];
const sx = (c: number) => S_COLS.slice(0, c).reduce((a, b) => a + b, 0);
const sy = (r: number) => S_ROWS.slice(0, r).reduce((a, b) => a + b, 0);
const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US");
const ACCTS = [
  {
    logo: "HF",
    bg: "#1d4ed8",
    name: "Halvorsen Freight",
    owner: "Ama Okafor",
    plans: ["Enterprise"],
    status: ["Renewed", "renewed"],
    prior: 162500,
    arr: 184000,
    u: [71, 78, 84],
    signed: true,
  },
  {
    logo: "OH",
    bg: "#0f766e",
    name: "Okapi Health",
    owner: "Léa Moreau",
    plans: ["Growth"],
    status: ["At risk", "risk"],
    prior: 70800,
    arr: 62400,
    u: [64, 58, 51],
    signed: false,
  },
  {
    logo: "NE",
    bg: "#7c2d12",
    name: "Nordvik Energy",
    owner: "Jonas Lindqvist",
    plans: ["Enterprise", "Analytics add-on"],
    status: ["Renewed", "renewed"],
    prior: 214000,
    arr: 241900,
    u: [88, 91, 95],
    signed: true,
  },
  {
    logo: "BL",
    bg: "#4338ca",
    name: "Brightwater Labs",
    owner: "Sami Haddad",
    plans: ["Starter"],
    status: ["Pending", "pending"],
    prior: 18600,
    arr: 18600,
    u: [40, 44, 47],
    signed: false,
  },
  {
    logo: "TR",
    bg: "#be123c",
    name: "Tanaka Robotics",
    owner: "Ama Okafor",
    plans: ["Growth"],
    status: ["Renewed", "renewed"],
    prior: 88000,
    arr: 96250,
    u: [66, 70, 69],
    signed: true,
  },
  {
    logo: "PS",
    bg: "#334155",
    name: "Pell Street Bank",
    owner: "Léa Moreau",
    plans: ["Enterprise"],
    status: ["Churned", "churned"],
    prior: 132000,
    arr: 0,
    u: [52, 31, 12],
    signed: false,
  },
];
const gridStyle = {
  "--cols": S_COLS.map((w) => w + "px").join(" "),
  "--rows": S_ROWS.map((h) => h + "px").join(" "),
};
const gridHtml = (() => {
  const sc = (r: number, c: number, html: string | number, cls = "", span: number | "" = "") =>
    `<div class="s ${cls}" style="grid-row:${r + 1}${span ? ";grid-row-end:span " + span : ""};grid-column:${c + 1}">${html}</div>`;
  let g = '<div class="s lt" style="grid-row:1;grid-column:1"></div>';
  "ABCDEFGHIJKLM"
    .split("")
    .forEach(
      (L, i) => (g += `<div class="s lt" style="grid-row:1;grid-column:${i + 2}">${L}</div>`),
    );
  for (let r = 1; r <= 10; r++)
    g += `<div class="s rn" style="grid-row:${r + 1};grid-column:1">${r}</div>`;
  const grp = (c: number, span: number, t: string) =>
    `<div class="s gh" style="grid-row:2;grid-column:${c + 1} / span ${span}">${t}</div>`;
  g +=
    grp(1, 3, "Account") +
    grp(4, 2, "Contract") +
    grp(6, 3, "Revenue") +
    grp(9, 3, "Usage %") +
    grp(12, 2, "Health");
  [
    "",
    "Account",
    "Owner",
    "Plan",
    "Status",
    "Prior ARR",
    "ARR",
    "Δ ARR",
    "Jul",
    "Aug",
    "Sep",
    "Trend",
    "Signed",
  ].forEach((h, i) => (g += sc(2, i + 1, h, "hd" + (i >= 5 && i <= 10 ? " r" : ""))));
  let r = 3;
  ACCTS.forEach((a) => {
    const span = a.plans.length;
    const sp = span > 1 ? span : "";
    const delta = a.arr - a.prior;
    g += sc(r, 1, `<span class="logo" style="background:${a.bg}">${a.logo}</span>`, "ctr", sp);
    g += sc(r, 2, a.name, "link", sp);
    g += sc(r, 3, a.owner, "", sp);
    a.plans.forEach((p, k) => (g += sc(r + k, 4, `${p}${icon("chevron-down", "dd")}`)));
    g += sc(r, 5, a.status[0]!, "badge " + a.status[1], sp);
    g += sc(r, 6, usd(a.prior), "r", sp);
    g += sc(r, 7, usd(a.arr), "r", sp);
    g += sc(
      r,
      8,
      `${icon("lock", "lock")}${delta > 0 ? "+" : ""}${usd(delta)}`,
      "r " + (delta < 0 ? "neg" : delta > 0 ? "pos" : ""),
      sp,
    );
    a.u.forEach((v, k) => (g += sc(r, 9 + k, v, "r", sp)));
    g += sc(r, 12, spark(a.u, 56, 16, "#2563eb"), "ctr", sp);
    g += sc(r, 13, a.signed ? icon("square-check", "chk") : icon("square", "unchk"), "ctr", sp);
    r += span;
  });
  const tp = ACCTS.reduce((s, a) => s + a.prior, 0);
  const ta = ACCTS.reduce((s, a) => s + a.arr, 0);
  g +=
    sc(10, 1, "", "sm") +
    sc(10, 2, "Total", "sm") +
    sc(10, 3, "", "sm") +
    sc(10, 4, "", "sm") +
    sc(10, 5, "", "sm");
  g +=
    sc(10, 6, usd(tp), "sm r") + sc(10, 7, usd(ta), "sm r") + sc(10, 8, usd(ta - tp), "sm r neg");
  g +=
    sc(10, 9, "", "sm") +
    sc(10, 10, "", "sm") +
    sc(10, 11, "", "sm") +
    sc(10, 12, "", "sm") +
    sc(10, 13, "3 of 6", "sm ctr");
  // freeze lines: below row 2, right of column B
  g += `<i class="sfrz" style="left:28px;right:0;top:${sy(2) - 1}px;height:2px"></i><i class="sfrz" style="left:${sx(2) - 1}px;top:20px;bottom:0;width:2px"></i>`;
  g += `<div class="ddlist" style="left:${sx(3)}px;top:${sy(4)}px"><div>Starter</div><div class="on">Growth</div><div>Enterprise</div></div>`;
  return g;
})();

let pick: (i: number) => void = () => {};

useWidget(root, (s) => {
  revealOnScroll(s);
  const reduce = prefersReducedMotion();
  const spec = s.$(".spec");
  const region = s.$(".region");
  const rnum = s.$(".rnum");
  const sel = s.$(".sel");
  const ccard = s.$(".ccard");
  const cline = s.$<SVGSVGElement>("svg.cline");
  let auto = !reduce;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  function selectFeature(i: number) {
    featIdx.value = i;
    const f = FEATURES[i]!;
    spec.dataset.feat = f.id;
    refText.value = f.cell;
    valText.value = f.fx;
    const [c1, r1, c2, r2] = f.reg;
    const x = sx(c1);
    const y = sy(r1);
    const w = sx(c2 + 1) - x;
    const h = sy(r2 + 1) - y;
    Object.assign(region.style, {
      left: x + "px",
      top: y + "px",
      width: w + "px",
      height: h + "px",
    });
    Object.assign(rnum.style, { left: x + "px", top: y + "px" });
    rnum.textContent = String(i + 1).padStart(2, "0");
    const m = f.cell.match(/([A-Z])(\d+)/)!;
    const cc = m[1]!.charCodeAt(0) - 64;
    const rr = +m[2]!;
    Object.assign(sel.style, {
      left: sx(cc) - 1 + "px",
      top: sy(rr) - 1 + "px",
      width: S_COLS[cc]! + 2 + "px",
      height: S_ROWS[rr]! + 2 + "px",
    });
    ccard.innerHTML = `<div class="ct"><span>renewals.schema.ts</span><b>${f.name}</b></div><pre>${hl(f.code)}</pre>`;
    const gTop = 32;
    const specW = spec.clientWidth;
    const cardW = ccard.offsetWidth;
    const midX = x + w / 2;
    const left = Math.min(Math.max(midX - cardW / 2, 10), specW - cardW - 10);
    // the card hangs below the sheet so the sheet itself stays readable
    const top = spec.offsetHeight + 30;
    ccard.style.left = left + "px";
    ccard.style.top = top + "px";
    const ax = midX;
    const ay = gTop + y + h + 3;
    const bx = Math.min(Math.max(ax, left + 24), left + cardW - 24);
    const by = top;
    const minx = Math.min(ax, bx) - 4;
    const miny = Math.min(ay, by) - 4;
    Object.assign(cline.style, {
      left: minx + "px",
      top: miny + "px",
      width: Math.abs(bx - ax) + 8 + "px",
      height: Math.abs(by - ay) + 8 + "px",
    });
    cline
      .querySelector("path")!
      .setAttribute(
        "d",
        `M${ax - minx} ${ay - miny} L${ax - minx} ${(ay + by) / 2 - miny} L${bx - minx} ${(ay + by) / 2 - miny} L${bx - minx} ${by - miny}`,
      );
  }
  pick = (i: number) => {
    auto = false;
    s.clearTimeout(timer);
    selectFeature(i);
  };
  function loop() {
    if (!auto) return;
    if (visible) selectFeature((featIdx.value + 1) % FEATURES.length);
    timer = s.timeout(loop, 2600);
  }
  s.observe(spec, ([en]) => (visible = !!en?.isIntersecting), { threshold: 0.3 });
  s.on(window, "resize", () => selectFeature(featIdx.value));
  requestAnimationFrame(() => selectFeature(featIdx.value));
  if (auto) timer = s.timeout(loop, 2600);
});
</script>

<template>
  <section id="render" ref="root" class="sec">
    <div class="wrap">
      <h2 class="h2 reveal">
        Effortlessly beautiful.<br /><span class="accent">Down to the cell.</span>
      </h2>
      <p class="lede reveal">
        Badges, sparklines, images, validation, grouped headers, totals. Every one is a schema
        field, so every report your app ships looks the same way.
      </p>
      <div class="render-grid">
        <div class="findex">
          <div v-for="grp in GROUPS" :key="grp.g" class="fgroup">
            <h3>{{ grp.g }}</h3>
            <button
              v-for="f in grp.items"
              :key="f.id"
              type="button"
              class="fitem"
              :class="{ on: featIdx === f.i }"
              @mouseenter="pick(f.i)"
              @click="pick(f.i)"
            >
              <span class="n">{{ String(f.i + 1).padStart(2, "0") }}</span
              >{{ f.name }}
            </button>
          </div>
        </div>
        <div class="spec-wrap reveal">
          <div class="spec-stack">
            <div class="ghost g2" />
            <div class="ghost g1" />
            <div class="spec">
              <div class="sfbar">
                <span class="ref">{{ refText }}</span
                ><span class="fxs">fx</span><span class="val">{{ valText }}</span>
              </div>
              <div class="sgrid-wrap">
                <div class="sgrid" :style="gridStyle" v-html="gridHtml" />
                <div class="sel" />
                <div class="region" />
                <div class="rnum">10</div>
              </div>
              <div class="stabs">
                <span class="on">Renewals</span><span>Pipeline</span><span>Board</span
                ><span>+</span>
              </div>
              <div class="ccard" />
              <svg class="cline" aria-hidden="true"><path /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
