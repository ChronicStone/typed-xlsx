<script setup lang="ts">
import { ref } from "vue";
import { hl, icon, money, prefersReducedMotion, revealOnScroll, useWidget } from "./bp";

/**
 * "Bake it in TypeScript. Or wire it into Excel." One schema, two columns: a baked accessor
 * whose value is fixed at export, and a wired formula that Excel reruns after an edit.
 * Four steps loop while visible: export, open, edit a quantity, recalculate.
 */
const root = ref<HTMLElement | null>(null);

const CODE = [
  '.column("total", {',
  '  header: "Total · baked",',
  "  accessor: (row) => row.qty * row.unitPrice,",
  "})",
  '.column("wired", {',
  '  header: "Total · wired",',
  "  formula: ({ refs }) =>",
  '    refs.column("qty").mul(refs.column("unitPrice")),',
  "  conditionalStyle: (c) => c.when(",
  '    ({ refs }) => refs.column("wired").gt(5000),',
  '    { fill: { color: { rgb: "C9F2D9" } } },',
  "  ),",
  '  summary: (s) => [s.formula("sum")],',
  "})",
];
const LINES = CODE.map((line, i) => ({ i, cls: i < 4 ? "bk" : "wr", html: hl(line || " ") }));

const STEPS = [
  { b: "Export", t: "Your code bakes the values and writes the formula into the file." },
  { b: "Open in Excel", t: "Only the file travels. Your TypeScript stays on your server." },
  { b: "Edit a quantity", t: "Someone changes Okapi Health from 4 to 6." },
  {
    b: "Recalculate",
    t: "The wired total, its highlight and the sum follow. The baked total stays 5,000.",
  },
];

type Row = [name: string, qty: number, unitPrice: number];
const ROWS: Row[] = [
  ["Halvorsen Freight", 12, 480],
  ["Okapi Health", 4, 1250],
  ["Brightwater Labs", 30, 96.5],
];
const DUR: Record<number, number> = { 1: 3600, 2: 3000, 3: 2800, 4: 4800 };

type Rect = { x: number; y: number; w: number; h: number; cx: number; cy: number };

useWidget(root, (s) => {
  revealOnScroll(s);
  const reduce = prefersReducedMotion();
  const bwEl = s.$(".bw");
  const book = s.$(".bw-book");
  const stage = s.$(".bw-stage");
  const grid = s.$(".bw-grid");
  const chips = s.$(".bw-chips");

  const bw = {
    baked: 0,
    wiredMode: "none" as "none" | "formula" | "value",
    wiredCount: 0,
    qty: [12, 4, 30] as Array<number | string>,
    vals: [5760, 5000, 2895],
    pick: "E3",
    editing: false,
    pop: {} as Record<string, boolean>,
  };

  function cellText(addr: string) {
    const col = addr[0];
    const row = Number(addr.slice(1));
    if (row === 5) return col === "E" ? "=SUM(E2:E4)" : col === "A" ? "Total" : "";
    const k = row - 2;
    const d = ROWS[k]!;
    const byCol: Record<string, string> = {
      A: d[0],
      B: String(bw.qty[k]),
      C: String(d[2]),
      D: k < bw.baked ? String(d[1] * d[2]) : "",
      E: bw.wiredMode === "none" ? "" : `=(B${row}*C${row})`,
    };
    return byCol[col!] ?? "";
  }
  function bar(text?: string) {
    s.$(".bw-ref").textContent = bw.pick;
    s.$(".bw-val").textContent = text ?? cellText(bw.pick);
  }
  function render() {
    const pk = (addr: string) => (bw.pick === addr ? " pick" : "");
    let g = ["", "A", "B", "C", "D", "E"]
      .map((x, i) => `<div class="s lt" style="grid-row:1;grid-column:${i + 1}">${x}</div>`)
      .join("");
    for (let r = 1; r <= 5; r++)
      g += `<div class="s rn" style="grid-row:${r + 1};grid-column:1">${r}</div>`;
    [
      "Customer",
      "Qty",
      '<span class="lg">Unit&nbsp;</span>price',
      `${icon("stamp", "hic bk")}<span class="lg">Total&nbsp;·&nbsp;</span>baked`,
      `${icon("square-function", "hic wr")}<span class="lg">Total&nbsp;·&nbsp;</span>wired`,
    ].forEach(
      (h, i) =>
        (g += `<div class="s hd${i ? " r" : ""}" style="grid-row:2;grid-column:${i + 2}">${h}</div>`),
    );
    ROWS.forEach((d, k) => {
      const gr = k + 3;
      const sr = k + 2;
      const baked =
        k < bw.baked
          ? `<span class="${bw.pop["D" + sr] ? "pop" : ""}">${money(d[1] * d[2])}</span>`
          : "";
      let wired = "";
      if (bw.wiredMode === "formula" && k < bw.wiredCount)
        wired = `<span class="fx${bw.pop["E" + sr] ? " pop" : ""}">=(B${sr}*C${sr})</span>`;
      if (bw.wiredMode === "value") wired = money(bw.vals[k]!);
      const hi = bw.wiredMode === "value" && bw.vals[k]! > 5000 ? " hi" : "";
      const name = d[0].replace(" ", '<span class="lg">&nbsp;') + "</span>";
      g += `<div class="s${pk("A" + sr)}" data-ref="A${sr}" style="grid-row:${gr};grid-column:2">${name}</div>`;
      g += `<div class="s r${pk("B" + sr)}${bw.editing && k === 1 ? " editing" : ""}" data-ref="B${sr}" style="grid-row:${gr};grid-column:3">${bw.qty[k]}</div>`;
      g += `<div class="s r${pk("C" + sr)}" data-ref="C${sr}" style="grid-row:${gr};grid-column:4">${money(d[2])}</div>`;
      g += `<div class="s r bk${pk("D" + sr)}" data-ref="D${sr}" style="grid-row:${gr};grid-column:5">${baked}</div>`;
      g += `<div class="s r wr${hi}${pk("E" + sr)}" data-ref="E${sr}" style="grid-row:${gr};grid-column:6">${wired}</div>`;
    });
    let sum = "";
    if (bw.wiredMode === "formula" && bw.wiredCount > 3)
      sum = `<span class="fx${bw.pop.E5 ? " pop" : ""}">=SUM(E2:E4)</span>`;
    if (bw.wiredMode === "value") sum = money(bw.vals.reduce((a, b) => a + b, 0));
    g += `<div class="s sm" style="grid-row:6;grid-column:2">Total</div><div class="s sm" style="grid-row:6;grid-column:3"></div><div class="s sm" style="grid-row:6;grid-column:4"></div><div class="s sm r bk" data-ref="D5" style="grid-row:6;grid-column:5"></div>`;
    g += `<div class="s sm r wr${pk("E5")}" data-ref="E5" style="grid-row:6;grid-column:6">${sum}</div>`;
    grid.innerHTML = g;
    bw.pop = {};
    bar();
  }

  const rel = (el: Element, base: Element): Rect => {
    const b = base.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left - b.left;
    const y = r.top - b.top;
    return { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
  };
  const cell = (addr: string, base: Element = book) =>
    rel(s.$(`.bw-grid [data-ref="${addr}"]`), base);
  const svgEl = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  };

  function drawWires() {
    const svg = s.$(".bw-wires");
    svg.innerHTML = "";
    const B = cell("B3");
    const C = cell("C3");
    const E = cell("E3");
    const E5 = cell("E5");
    const arc = (a: Rect, b: Rect, lift: number) =>
      `M${a.cx} ${a.y + 5} C ${a.cx} ${a.y - lift}, ${b.cx} ${b.y - lift}, ${b.cx} ${b.y + 5}`;
    svg.append(
      svgEl("path", { "data-w": "b", d: arc(B, E, 34) }),
      svgEl("path", { "data-w": "c", d: arc(C, E, 20) }),
      svgEl("path", {
        "data-w": "s",
        d: `M${E.x + E.w - 8} ${E.cy} C ${E.x + E.w + 16} ${E.cy}, ${E5.x + E5.w + 16} ${E5.cy}, ${E5.x + E5.w - 8} ${E5.cy}`,
      }),
    );
  }
  const codeLines = () => s.$$(".bw-code .l");
  const midY = (els: HTMLElement[]) => {
    const a = rel(els[0]!, stage);
    const z = rel(els[els.length - 1]!, stage);
    return (a.y + z.y + z.h) / 2;
  };
  function drawConduit() {
    const svg = s.$(".bw-conduit");
    if (getComputedStyle(svg).display === "none") return false;
    const lines = codeLines();
    const box = rel(svg, stage);
    const W = box.w;
    const yB = midY(lines.slice(0, 4)) - box.y;
    const yW = midY(lines.slice(4)) - box.y;
    const yD = cell("D3", stage).cy - box.y - 7;
    const yE = cell("E3", stage).cy - box.y + 7;
    svg.setAttribute("viewBox", `0 0 ${W} ${box.h}`);
    svg.innerHTML = `<path class="ca" d="M0 ${yB} C ${W * 0.55} ${yB}, ${W * 0.45} ${yD}, ${W} ${yD}"/><path class="cw" d="M0 ${yW} C ${W * 0.55} ${yW}, ${W * 0.45} ${yE}, ${W} ${yE}"/>`;
    return true;
  }

  const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
  /** Animates `fn(progress)` over `ms` with requestAnimationFrame; stops if the widget unmounts. */
  const tween = (ms: number, fn: (p: number) => void) =>
    new Promise<void>((resolve) => {
      const t0 = performance.now();
      const step = (t: number) => {
        if (s.dead) return;
        const p = Math.min(1, (t - t0) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  /** A value or formula chip flies from the server card into its cell. */
  function fly(cls: string, text: string, fromY: number, toRef: string, ms: number) {
    const el = document.createElement("div");
    el.className = "bw-chip " + cls;
    el.textContent = text;
    chips.appendChild(el);
    const srv = rel(s.$(".bw-server"), stage);
    const bk = rel(book, stage);
    const T = cell(toRef, stage);
    const P0 = { x: srv.x + srv.w, y: fromY };
    const P1 = { x: bk.x, y: T.cy };
    const P2 = { x: T.cx, y: T.cy };
    const c1 = { x: P0.x + (P1.x - P0.x) * 0.6, y: P0.y };
    const c2 = { x: P0.x + (P1.x - P0.x) * 0.4, y: P1.y };
    const bez = (u: number, a: number, b: number, c: number, d: number) =>
      (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
    return tween(ms, (p) => {
      const e = ease(p);
      const split = 0.58;
      let x: number;
      let y: number;
      if (e < split) {
        const u = e / split;
        x = bez(u, P0.x, c1.x, c2.x, P1.x);
        y = bez(u, P0.y, c1.y, c2.y, P1.y);
      } else {
        const u = (e - split) / (1 - split);
        x = P1.x + (P2.x - P1.x) * u;
        y = P1.y;
      }
      el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${0.85 + 0.15 * Math.sin(Math.PI * e)})`;
      if (p >= 1) el.remove();
    });
  }
  /** A dot runs along one of the dependency wires. */
  function pulse(wire: string, ms: number) {
    const path = s.$<SVGPathElement>(`.bw-wires [data-w="${wire}"]`);
    if (!path) return Promise.resolve();
    const c = svgEl("circle", { r: 4.5, class: "pulse" });
    s.$(".bw-wires").appendChild(c);
    const len = path.getTotalLength();
    return tween(ms, (p) => {
      const pt = path.getPointAtLength(ease(p) * len);
      c.setAttribute("cx", String(pt.x));
      c.setAttribute("cy", String(pt.y));
      if (p >= 1) c.remove();
    });
  }
  function count(addr: string, from: number, to: number, ms: number) {
    const el = s.$(`.bw-grid [data-ref="${addr}"]`);
    return tween(ms, (p) => (el.textContent = money(from + (to - from) * (1 - (1 - p) ** 3))));
  }
  function stamp(mode: "animate" | "still" | null) {
    const st = s.$(".bw-stamp");
    st.classList.remove("on", "still");
    if (!mode) return;
    // The stamp sits on the empty total row (C5:D5), so the unchanged 5,000 in D3 stays readable.
    const D = cell("D5");
    st.style.left = D.x + D.w - st.offsetWidth - 6 + "px";
    st.style.top = D.y + (D.h - st.offsetHeight) / 2 + "px";
    if (mode === "animate") {
      void st.offsetWidth;
      st.classList.add("on");
    } else st.classList.add("still");
  }
  function cursor(addr: string | null) {
    const cur = s.$(".bw-cursor");
    if (!addr) {
      cur.classList.remove("on");
      return;
    }
    const c = cell(addr);
    cur.style.left = c.cx - 3 + "px";
    cur.style.top = c.cy - 2 + "px";
    cur.classList.add("on");
  }
  function rail(n: number, dur: number) {
    s.$$(".bw-steps li").forEach((li) => {
      const st = Number(li.dataset.s);
      li.classList.toggle("done", st < n || (st === n && !dur));
      li.classList.remove("on");
      li.style.removeProperty("--w");
      li.style.removeProperty("--dur");
    });
    if (!dur) return;
    const li = s.$(`.bw-steps li[data-s="${n}"]`);
    li.style.setProperty("--w", "0%");
    li.classList.add("on");
    void li.offsetWidth;
    li.style.setProperty("--dur", dur + "ms");
    li.style.setProperty("--w", "100%");
  }

  /** Static end state of step n (1..4). */
  function setState(n: number) {
    bw.baked = n >= 1 ? 3 : 0;
    bw.wiredMode = n >= 2 ? "value" : n >= 1 ? "formula" : "none";
    bw.wiredCount = 4;
    bw.qty = [12, n >= 3 ? 6 : 4, 30];
    const q = n >= 4 ? [12, 6, 30] : [12, 4, 30];
    bw.vals = ROWS.map((d, k) => q[k]! * d[2]);
    bw.pick = n === 3 ? "B3" : "E3";
    bw.editing = n === 3;
    bwEl.classList.toggle("off", n >= 2);
    bwEl.classList.toggle("wired", n >= 2);
    render();
    drawWires();
    drawConduit();
    stamp(n >= 4 ? "still" : null);
    cursor(n === 3 ? "B3" : null);
    rail(n, 0);
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
      chips.innerHTML = "";
      Object.assign(bw, {
        baked: 0,
        wiredMode: "formula",
        wiredCount: 0,
        qty: [12, 4, 30],
        vals: [5760, 5000, 2895],
        pick: "E3",
        editing: false,
      });
      bwEl.classList.remove("off", "wired");
      stamp(null);
      cursor(null);
      render();
      drawWires();
      const flies = drawConduit();
      const lines = codeLines();
      const yB = midY(lines.slice(0, 4));
      const yW = midY(lines.slice(4));
      const jobs: Promise<void>[] = [];
      ROWS.forEach((d, k) => {
        jobs.push(
          s.wait(k * 260).then(async () => {
            if (!alive()) return;
            if (flies) await fly("bk", money(d[1] * d[2]), yB, "D" + (k + 2), 900);
            if (!alive()) return;
            bw.baked = Math.max(bw.baked, k + 1);
            bw.pop["D" + (k + 2)] = true;
            render();
          }),
        );
        jobs.push(
          s.wait(420 + k * 260).then(async () => {
            if (!alive()) return;
            if (flies) await fly("wr", `=(B${k + 2}*C${k + 2})`, yW, "E" + (k + 2), 900);
            if (!alive()) return;
            bw.wiredCount = Math.max(bw.wiredCount, k + 1);
            bw.pop["E" + (k + 2)] = true;
            render();
          }),
        );
      });
      jobs.push(
        s.wait(420 + 3 * 260).then(async () => {
          if (!alive()) return;
          if (flies) await fly("wr", "=SUM(E2:E4)", yW, "E5", 900);
          if (!alive()) return;
          bw.wiredCount = 4;
          bw.pop.E5 = true;
          render();
        }),
      );
      await Promise.all(jobs);
    } else if (n === 2) {
      bwEl.classList.add("off");
      await s.wait(500);
      if (!alive()) return;
      bwEl.classList.add("wired");
      bw.wiredMode = "value";
      bw.vals = [5760, 5000, 2895];
      render();
      drawWires();
      await Promise.all([
        ...[0, 1, 2].map((k) => count("E" + (k + 2), 0, bw.vals[k]!, 900)),
        count("E5", 0, 13655, 1000),
      ]);
    } else if (n === 3) {
      cursor(null);
      const cur = s.$(".bw-cursor");
      const E5 = cell("E5");
      cur.style.transition = "none";
      cur.style.left = E5.cx + "px";
      cur.style.top = E5.y + E5.h + 30 + "px";
      void cur.offsetWidth;
      cur.style.transition = "";
      cur.classList.add("on");
      await s.wait(60);
      if (!alive()) return;
      cursor("B3");
      await s.wait(950);
      if (!alive()) return;
      bw.pick = "B3";
      render();
      await s.wait(450);
      if (!alive()) return;
      bw.editing = true;
      bw.qty = [12, "", 30];
      render();
      bar("");
      await s.wait(380);
      if (!alive()) return;
      bw.qty = [12, 6, 30];
      render();
      bar("6");
    } else if (n === 4) {
      bw.editing = false;
      bw.qty = [12, 6, 30];
      bw.pick = "E3";
      cursor(null);
      render();
      drawWires();
      await Promise.all([pulse("b", 900), pulse("c", 800)]);
      if (!alive()) return;
      bw.vals = [5760, 7500, 2895];
      render();
      s.$('.bw-grid [data-ref="E3"]').classList.add("hi");
      await Promise.all([count("E3", 5000, 7500, 700), pulse("s", 750)]);
      if (!alive()) return;
      await count("E5", 13655, 16155, 700);
      if (!alive()) return;
      stamp("animate");
    }
    const left = DUR[n]! - (performance.now() - t0);
    if (left > 0) await s.wait(left);
  }

  async function loop() {
    while (!s.dead) {
      for (let n = 1; n <= 4; n++) {
        while (!isVisible() && isAuto() && !s.dead) await s.wait(300);
        if (!isAuto() || s.dead) return;
        const g = gen;
        await play(n, g);
        if (g !== gen || !isAuto()) return;
      }
      await s.wait(900);
    }
  }

  s.on(s.$(".bw-steps"), "click", (e: MouseEvent) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("li");
    if (!li) return;
    const n = Number(li.dataset.s);
    auto = false;
    const g = ++gen;
    chips.innerHTML = "";
    if (n > 1) setState(n - 1);
    void play(n, g);
  });
  s.on(window, "resize", () => {
    drawWires();
    drawConduit();
    const st = s.$(".bw-stamp");
    if (st.classList.contains("still") || st.classList.contains("on")) stamp("still");
  });
  s.observe(book, ([en]) => (visible = !!en?.isIntersecting), { threshold: 0.3 });

  // Reduced motion shows the finished story; otherwise the loop starts once the sheet is in view.
  setState(reduce ? 4 : 1);
  if (auto) void loop();
});
</script>

<template>
  <section id="paths" ref="root" class="sec">
    <div class="wrap">
      <h2 class="h2 reveal">
        Bake it in TypeScript.<br /><span class="accent">Or wire it into Excel.</span>
      </h2>
      <p class="lede reveal">
        A column can be computed by your code while the file is written, or shipped as a typed
        formula that Excel reruns on every edit. The compiler checks both, and one schema can mix
        them column by column.
      </p>
      <div class="bw">
        <div class="bw-stage">
          <div class="bw-server">
            <div class="ct">
              <UIcon name="i-lucide-server" class="ic" /><span class="file">report.ts</span
              ><span class="where">runs on your server</span>
            </div>
            <pre
              class="bw-code"
            ><span v-for="l in LINES" :key="l.i" class="l" :class="l.cls" v-html="l.html" /></pre>
            <div class="bw-status">
              <span class="run"><span class="led" />exporting report.xlsx</span
              ><span class="gone"
                ><UIcon name="i-lucide-power" class="ic" />export done. This code is not in the
                file.</span
              >
            </div>
          </div>
          <svg class="bw-conduit" aria-hidden="true" />
          <div class="bw-book">
            <div class="spec">
              <div class="sfbar">
                <span class="ref bw-ref">E3</span><span class="fxs">fx</span
                ><span class="val bw-val" />
              </div>
              <div class="sgrid bw-grid" />
              <div class="stabs"><span class="on">report.xlsx</span><span>+</span></div>
            </div>
            <svg class="bw-wires" aria-hidden="true" />
            <div class="bw-stamp"><UIcon name="i-lucide-stamp" class="ic" />baked at export</div>
            <div class="bw-cursor">
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <path
                  d="M3 2l13 7.2-6.2 1.4L7.2 17z"
                  fill="#0a1f15"
                  stroke="#fff"
                  stroke-width="1.4"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
          <div class="bw-chips" />
        </div>
        <ol class="bw-steps">
          <li v-for="(st, i) in STEPS" :key="st.b" :data-s="i + 1">
            <b>{{ st.b }}</b
            ><span>{{ st.t }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
