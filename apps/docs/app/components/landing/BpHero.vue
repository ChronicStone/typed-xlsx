<script setup lang="ts">
import { ref } from "vue";
import { copyText, esc, money, prefersReducedMotion, spark, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);
const assembled = ref(true);
const focus = ref<number | null>(null);
const noTr = ref(true);
const shown = ref(0);
const copied = ref(false);

/* ---------- the exploded invoice workbook: six layers of one schema ---------- */
const H_COLS = [22, 128, 70, 40, 72, 80, 66];
const H_ROWS = [16, 20, 22, 25, 25, 25, 25, 25, 25, 25, 25];
const colX = (c: number) => H_COLS.slice(0, c - 1).reduce((a, b) => a + b, 0);
const rowY = (r: number) => H_ROWS.slice(0, r - 1).reduce((a, b) => a + b, 0);
const INV: Array<[string, string, number, number, number[]]> = [
  ["Halvorsen Freight", "Paid", 12, 480, [3, 5, 4, 6, 7, 9]],
  ["Okapi Health", "Due", 4, 1250, [6, 5, 5, 4, 4, 3]],
  ["Brightwater Labs", "Paid", 30, 96.5, [2, 3, 3, 5, 4, 6]],
  ["Tanaka Robotics", "Overdue", 8, 720, [7, 6, 4, 5, 3, 2]],
  ["Quarry Lane Studio", "Paid", 2, 3400, [4, 4, 5, 5, 6, 6]],
  ["Nordvik Energy", "Due", 16, 310, [3, 4, 6, 5, 7, 8]],
  ["Pell Street Bank", "Paid", 6, 1875, [5, 6, 6, 7, 8, 9]],
];
const cell = (r: number, c: number, html: string | number, cls = "", extra = "") =>
  `<div class="c ${cls}" style="grid-row:${r};grid-column:${c}${extra}">${html}</div>`;
const anc = (a: number, x: number, y: number) =>
  `<i class="anc" data-a="${a}" style="left:${x}px;top:${y}px"></i>`;

const layers: string[] = [];
{
  // 0: sheet grid + freeze panes
  let g = "";
  "ABCDEF".split("").forEach((L, i) => (g += cell(1, i + 2, L, "lt")));
  for (let k = 1; k <= 10; k++) g += cell(k + 1, 1, k, "rn");
  for (let k = 1; k <= 10; k++) for (let c = 2; c <= 7; c++) g += cell(k + 1, c, "", "gc");
  layers.push(g + '<i class="frz frz-h"></i><i class="frz frz-v"></i>' + anc(5, 478, 58));
}
{
  // 1: typed accessors, raw values
  let g = "";
  INV.forEach((r, i) => {
    g += cell(i + 4, 2, r[0]) + cell(i + 4, 4, r[2], "r") + cell(i + 4, 5, money(r[3]), "r");
  });
  layers.push(g + anc(4, colX(6), rowY(6) + 12));
}
{
  // 2: renderers, badges + sparklines
  let g = "";
  INV.forEach((r, i) => {
    g += cell(i + 4, 3, r[1], "bdg " + r[1].toLowerCase()) + cell(i + 4, 7, spark(r[4]));
  });
  layers.push(g + anc(3, 478, rowY(5) + 12));
}
{
  // 3: formulas + conditional style
  let g = "";
  INV.forEach((r, i) => {
    const row = i + 3;
    const total = r[2] * r[3];
    g += cell(
      i + 4,
      6,
      `<span class="ff">=ROUND(C${row}*D${row},2)</span><span class="fv">${money(total)}</span>`,
      "fcell" + (total >= 6000 ? " hi" : ""),
    );
  });
  layers.push(g + anc(2, colX(7), rowY(7) + 12));
}
{
  // 4: grouped headers
  let g =
    cell(2, 2, "Customer", "gh", ";grid-column-end:span 2") +
    cell(2, 4, "Billing", "gh", ";grid-column-end:span 3") +
    cell(2, 7, "Signal", "gh");
  ["Customer", "Status", "Qty", "Unit price", "Total", "Trend"].forEach(
    (h, i) => (g += cell(3, i + 2, h, "hd" + (i >= 2 && i <= 4 ? " r" : ""))),
  );
  layers.push(g + anc(0, colX(7), rowY(2) + 10));
}
{
  // 5: summary row
  const qty = INV.reduce((a, r) => a + r[2], 0);
  const tot = INV.reduce((a, r) => a + r[2] * r[3], 0);
  const g =
    cell(11, 2, "Total", "sm") +
    cell(11, 3, "", "sm") +
    cell(11, 4, qty, "sm r") +
    cell(11, 5, "", "sm") +
    cell(
      11,
      6,
      `<span class="ff">=SUM(E3:E9)</span><span class="fv">${money(tot)}</span>`,
      "sm fcell",
    ) +
    cell(11, 7, "", "sm");
  layers.push(g + anc(1, colX(7), rowY(11) + 12));
}

const CALLOUTS = [
  { layer: 4, title: "Grouped headers", code: '.group("billing")' },
  { layer: 5, title: "Summary rows", code: 's.formula("sum")' },
  { layer: 3, title: "Formula columns", code: 'refs.column("qty")' },
  { layer: 2, title: "Badges, sparklines", code: 'type: "badge"' },
  { layer: 1, title: "Typed accessors", code: '"customer.name"' },
  { layer: 0, title: "Freeze panes", code: "freezePane" },
];

function onCopy() {
  copyText("npm i typed-xlsx");
  copied.value = true;
  setTimeout(() => (copied.value = false), 1300);
}

let toggleHero: () => void = () => {};
let enterPart: (i: number) => void = () => {};

useWidget(root, (s) => {
  const reduce = prefersReducedMotion();
  const stage = s.$(".stage");
  const iso = s.$(".iso");
  const coEls = s.$$(".pr");
  const ldEls = s.$$<SVGGElement>("svg.leaders g");
  const ancEls = CALLOUTS.map((_c, i) => s.$(`.anc[data-a="${i}"]`, iso));
  let heroAuto = !reduce;
  let heroTimer: ReturnType<typeof setTimeout> | null = null;

  function setHero(state: "assembled" | "exploded", instant = false) {
    if (instant) noTr.value = true;
    assembled.value = state === "assembled";
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => (noTr.value = false)));
  }
  function stopAuto() {
    heroAuto = false;
    s.clearTimeout(heroTimer);
  }
  toggleHero = () => {
    stopAuto();
    setHero(assembled.value ? "exploded" : "assembled");
  };
  enterPart = (i: number) => {
    stopAuto();
    if (assembled.value) setHero("exploded");
    focus.value = i;
  };
  function heroLoop(next: "assembled" | "exploded") {
    if (!heroAuto) return;
    setHero(next);
    heroTimer = s.timeout(
      () => heroLoop(next === "exploded" ? "assembled" : "exploded"),
      next === "exploded" ? 7000 : 2800,
    );
  }

  // pointer tilt
  let rx = 52;
  let rz = -36;
  let trx = 52;
  let trz = -36;
  s.on(root.value!, "pointermove", (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    trx = 52 - dy * 6;
    trz = -36 + dx * 8;
  });
  s.on(root.value!, "pointerleave", () => {
    trx = 52;
    trz = -36;
  });

  let visible = true;
  s.observe(stage, ([en]) => (visible = !!en?.isIntersecting));

  function layoutCallouts() {
    const sr = stage.getBoundingClientRect();
    coEls.forEach((el, i) => {
      const anchor = ancEls[i];
      const g = ldEls[i];
      if (!anchor || !g) return;
      const a = anchor.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const ax = a.left - sr.left + 1;
      const ay = a.top - sr.top + 1;
      const ex = r.left - sr.left;
      const cy = r.top - sr.top + r.height / 2;
      const midX = Math.max(ax + 14, ex - 64);
      g.querySelector("path")!.setAttribute(
        "d",
        `M${ax.toFixed(1)} ${ay.toFixed(1)} H${midX.toFixed(1)} L${(ex - 20).toFixed(1)} ${cy.toFixed(1)} H${ex.toFixed(1)}`,
      );
      const ca = g.querySelector(".a")!;
      ca.setAttribute("cx", ax.toFixed(1));
      ca.setAttribute("cy", ay.toFixed(1));
      const cb = g.querySelector(".b")!;
      cb.setAttribute("cx", ex.toFixed(1));
      cb.setAttribute("cy", cy.toFixed(1));
    });
  }

  s.frame(() => {
    if (!visible) return;
    rx += (trx - rx) * 0.06;
    rz += (trz - rz) * 0.06;
    iso.style.setProperty("--rx", rx.toFixed(2) + "deg");
    iso.style.setProperty("--rz", rz.toFixed(2) + "deg");
    if (innerWidth > 767) layoutCallouts();
  });

  function sizeStage() {
    const w = stage.clientWidth;
    const gut = parseFloat(getComputedStyle(root.value!).getPropertyValue("--gutter")) || 40;
    const avail = innerWidth > 767 ? w - 256 - gut - 36 : w;
    const scale = Math.max(0.56, Math.min(1, avail / 540));
    iso.style.setProperty("--s", scale.toFixed(3));
    iso.style.setProperty("--iso-left", avail / 2 - 240 - 13 * scale + "px");
  }
  sizeStage();
  s.on(window, "resize", sizeStage);

  coEls.forEach((_el, i) => s.timeout(() => (shown.value = i + 1), 900 + i * 110));
  requestAnimationFrame(() => requestAnimationFrame(() => (noTr.value = false)));
  if (reduce) setHero("exploded", true);
  else s.timeout(() => heroLoop("exploded"), 700);
});
</script>

<template>
  <section id="hero" ref="root" class="hero-sec">
    <div class="wrap hero">
      <div>
        <h1 class="rise">Excel reports,<span class="accent">built to spec.</span></h1>
        <div class="dim rise" style="--d: 0.15s" aria-label="From 1 row to 1,048,576 rows">
          <span class="tick" /><span class="bar l" /><b>1 row to 1,048,576 rows</b
          ><span class="bar r" /><span class="tick" />
        </div>
        <p class="lede rise" style="--d: 0.25s">
          Type-safe schemas that render polished XLSX reports for TypeScript apps. Buffered or
          streamed, with zero runtime dependencies.
        </p>
        <div class="ctas rise" style="--d: 0.35s">
          <NuxtLink class="btn btn-primary" to="/getting-started/introduction">
            Get started <UIcon name="i-lucide-arrow-right" class="ic" />
          </NuxtLink>
          <button class="btn btn-ghost" type="button" @click="onCopy">
            npm i typed-xlsx
            <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="ic" />
          </button>
        </div>
      </div>
      <div class="stage">
        <div
          class="iso"
          :class="{ 'is-assembled': assembled, 'no-tr': noTr }"
          :data-focus="focus == null ? undefined : CALLOUTS[focus]!.layer"
        >
          <div class="ground" />
          <div v-for="(html, i) in layers" :key="i" class="slab" :data-i="i" :style="{ '--i': i }">
            <i class="edge edge-b" /><i class="edge edge-l" />
            <div class="face" v-html="html" />
            <div v-if="i === 0" class="scan" />
          </div>
        </div>
        <svg class="leaders" :class="{ dim: assembled }" aria-hidden="true">
          <g v-for="(c, i) in CALLOUTS" :key="c.title" :class="{ on: focus === i }">
            <path />
            <circle class="a" r="2.6" />
            <circle class="b" r="2.2" />
          </g>
        </svg>
        <div class="dwg">
          <div class="parts-h"><span>NO.</span><span>PART</span></div>
          <div class="parts">
            <button
              v-for="(c, i) in CALLOUTS"
              :key="c.title"
              type="button"
              class="pr"
              :class="{ on: focus === i, show: i < shown }"
              @mouseenter="enterPart(i)"
              @focus="enterPart(i)"
              @mouseleave="focus = null"
              @blur="focus = null"
            >
              <span class="no">{{ i + 1 }}</span>
              <span class="pt"
                ><b>{{ c.title }}</b
                ><code v-html="esc(c.code)"
              /></span>
            </button>
          </div>
          <div class="tblock">
            <div class="tt">INVOICE REPORT</div>
            <dl>
              <dt>schema</dt>
              <dd>createExcelSchema&lt;Invoice&gt;()</dd>
              <dt>parts</dt>
              <dd>6 layers, 1 schema</dd>
              <dt>scale</dt>
              <dd>1 : 1,048,576 rows</dd>
            </dl>
            <div class="tb-act">
              <span>{{ assembled ? "rendered sheet" : "exploded view" }}</span>
              <button type="button" @click="toggleHero()">
                <UIcon name="i-lucide-layers" class="ic" /><span>{{
                  assembled ? "Explode" : "Assemble"
                }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
