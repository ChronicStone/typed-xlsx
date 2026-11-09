<script setup lang="ts">
import { ref } from "vue";
import { esc, prefersReducedMotion, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);
const rowsText = ref("1");
const batchesText = ref("one in-memory pass");
const mode = ref<"buffered" | "stream">("buffered");
const rowsNow = ref(1);

/* Measured on the streaming engine; see packages/benchmark/artifacts/reports/stream/THROUGHPUT_2026-09-22.md */
const STATS = [
  { at: 200_000, k: "200,000 rows", v: "3.72", u: "s", v2: "274", u2: "MiB" },
  { at: 500_000, k: "500,000 rows", v: "9.30", u: "s", v2: "279", u2: "MiB" },
  { at: 500_000, k: "vs 4.2.0 on 500,000 rows", v: "3.3", u: "× faster" },
];

useWidget(root, (s) => {
  const reduce = prefersReducedMotion();
  const pipe = s.$<SVGSVGElement>("svg.pipe");
  const C30 = 0.866;
  const S30 = 0.5;
  const P = (x: number, y: number, z = 0) => [(x - y) * C30, (x + y) * S30 - z] as const;
  const pts = (a: ReadonlyArray<readonly [number, number]>) =>
    a.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  function box(cx: number, cy: number, w: number, d: number, h: number, cls = "", z0 = 0) {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - d / 2;
    const y1 = cy + d / 2;
    const zt = z0 + h;
    return (
      `<g class="${cls}"><polygon class="f-l" points="${pts([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, zt), P(x0, y1, zt)])}"/>` +
      `<polygon class="f-r" points="${pts([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, zt), P(x1, y0, zt)])}"/>` +
      `<polygon class="f-t" points="${pts([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)])}"/></g>`
    );
  }
  type Mode = "buffered" | "stream";
  const NODES: Array<{
    id: string;
    t: number;
    w: number;
    d: number;
    h: number;
    stack?: number;
    cap: string;
    code: Record<Mode, string>;
  }> = [
    {
      id: "src",
      t: 40,
      w: 130,
      d: 100,
      h: 64,
      cap: "SOURCE",
      code: { buffered: "rows: Invoice[]", stream: "for await (batch of cursor)" },
    },
    {
      id: "commit",
      t: 250,
      w: 112,
      d: 80,
      h: 44,
      cap: "COMMIT",
      code: { buffered: '.table("invoices", { rows })', stream: "table.commit({ rows: batch })" },
    },
    {
      id: "xml",
      t: 420,
      w: 112,
      d: 80,
      h: 44,
      cap: "SERIALIZE",
      code: { buffered: "cells → sheet XML", stream: "cells → sheet XML" },
    },
    {
      id: "spool",
      t: 590,
      w: 112,
      d: 80,
      h: 12,
      stack: 3,
      cap: "SPOOL",
      code: { buffered: "held in memory", stream: "64 KiB chunks, backpressure" },
    },
    {
      id: "zip",
      t: 775,
      w: 150,
      d: 120,
      h: 84,
      cap: "PACKAGE",
      code: { buffered: "own ZIP engine", stream: "own ZIP engine" },
    },
  ];
  const OUTS = [
    { o: -210, code: "writeToFile()" },
    { o: -75, code: "toBuffer()" },
    { o: 60, code: "pipeToNode()" },
    { o: 195, code: "toReadableStream()" },
  ];
  const T_OUT = 985;
  let scaleMode: Mode = "buffered";
  let activeOut = 0;

  function nodeLabel(n: (typeof NODES)[number], m: Mode) {
    const [lx, ly] = P(n.w / 2, -n.t + n.d / 2, 0);
    const x = lx + 16;
    const y = ly + 20;
    return `<line class="lead" x1="${lx + 4}" y1="${ly + 4}" x2="${x - 4}" y2="${y - 8}"/><text class="cap" x="${x}" y="${y}">${n.cap}</text><text x="${x}" y="${y + 19}">${esc(n.code[m])}</text>`;
  }
  function renderPipeStatic() {
    let wires = `<polyline class="wire on" points="${pts([P(0, -40), P(0, -775)])}"/>`;
    OUTS.forEach((o, k) => {
      wires += `<polyline class="wire ${k === activeOut ? "on" : ""}" points="${pts([P(0, -775), P(0, -880), P(o.o, -880), P(o.o, -T_OUT)])}"/>`;
    });
    let nodes = "";
    [...OUTS]
      .sort((a, b) => a.o - b.o)
      .forEach((o) => {
        const k = OUTS.indexOf(o);
        nodes += box(
          o.o,
          -T_OUT,
          84,
          64,
          26,
          "node out" + (k === activeOut ? " hot" : "") + `" data-out="${k}`,
        );
      });
    [...NODES]
      .sort((a, b) => b.t - a.t)
      .forEach((n) => {
        const off = scaleMode === "buffered" && n.id === "spool" ? " off" : "";
        if (n.stack) {
          for (let k = 0; k < n.stack; k++)
            nodes += box(0, -n.t, n.w, n.d, n.h, "node" + off, k * (n.h + 7));
        } else nodes += box(0, -n.t, n.w, n.d, n.h, "node" + off);
      });
    let labels = NODES.map((n) => nodeLabel(n, scaleMode)).join("");
    OUTS.forEach((o) => {
      const [x, y] = P(o.o, -T_OUT - 70, 0);
      labels += `<text x="${x + 4}" y="${y + 2}">${esc(o.code)}</text>`;
    });
    pipe.innerHTML = `<g class="p-wires">${wires}</g><g class="p-packets"></g><g class="p-nodes">${nodes}</g><g class="p-labels">${labels}</g>`;
  }
  renderPipeStatic();

  let packets: Array<{ t: number; big: boolean }> = [];
  let bytes: Array<{ s: number; k: number }> = [];
  let spawnAcc = 0;
  let lastT = performance.now();
  let visible = false;
  let scaleP = -1;
  const LOGMAX = Math.log10(1048576);

  function setRows(p: number) {
    scaleP = p;
    let rows = p >= 0.985 ? 1048576 : Math.max(1, Math.round(10 ** ((p / 0.985) * LOGMAX)));
    rows = Math.min(rows, 1048576);
    if (rows > 2000 && rows < 1048576) rows = Math.round(rows / 1000) * 1000;
    rowsNow.value = rows;
    rowsText.value = rows.toLocaleString("en-US");
    const m: Mode = rows >= 5000 ? "stream" : "buffered";
    batchesText.value =
      m === "stream"
        ? `${Math.ceil(rows / 5000).toLocaleString("en-US")} batches × 5,000 rows`
        : "one in-memory pass";
    mode.value = m;
    if (m !== scaleMode) {
      scaleMode = m;
      renderPipeStatic();
    }
  }
  setRows(0);

  const section = root.value!;
  s.observe(section, ([en]) => (visible = !!en?.isIntersecting));

  function tickPipe(dt: number) {
    const stream = scaleMode === "stream";
    const rate = stream
      ? 0.9 + 5.5 * Math.max(0, (Math.log10(rowsNow.value) - 3.7) / (LOGMAX - 3.7))
      : 0.38;
    spawnAcc += dt * rate;
    if (spawnAcc >= 1 && packets.length < 40) {
      spawnAcc -= 1;
      packets.push({ t: 40, big: !stream });
    }
    const speed = stream ? 260 + rate * 30 : 230;
    packets.forEach((p) => (p.t += speed * dt));
    packets = packets.filter((p) => {
      if (p.t < 760) return true;
      bytes.push({ s: 0, k: activeOut });
      return false;
    });
    bytes.forEach((b) => (b.s += dt * 1.6));
    bytes = bytes.filter((b) => {
      if (b.s < 1) return true;
      const out = pipe.querySelector(`[data-out="${b.k}"]`);
      if (out) {
        out.classList.add("hit");
        s.timeout(() => out.classList.remove("hit"), 160);
      }
      return false;
    });
    let g = "";
    packets.forEach((p) => {
      if (p.big) g += box(0, -p.t, 74, 54, 18, "pk", 4);
      else if (p.t < 450) g += box(0, -p.t, 54, 40, 9, "pk", 4);
      else for (let k = 0; k < 3; k++) g += box(0, -p.t, 38, 28, 3, "ch", 4 + k * 6);
    });
    bytes.forEach((b) => {
      const o = OUTS[b.k]!.o;
      const seg = [
        [0, -775],
        [0, -880],
        [o, -880],
        [o, -T_OUT],
      ] as const;
      const lens = [105, Math.abs(o), 105];
      const tot = lens[0]! + lens[1]! + lens[2]!;
      let d = b.s * tot;
      let i = 0;
      while (i < 2 && d > lens[i]!) {
        d -= lens[i]!;
        i++;
      }
      const a = seg[i]!;
      const z = seg[i + 1]!;
      const f = lens[i] ? d / lens[i]! : 1;
      g += box(a[0] + (z[0] - a[0]) * f, a[1] + (z[1] - a[1]) * f, 18, 18, 6, "pk", 2);
    });
    const pk = pipe.querySelector(".p-packets");
    if (pk) pk.innerHTML = g;
  }

  s.frame((now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!visible) return;
    const r = section.getBoundingClientRect();
    const span = r.height - innerHeight;
    const navH = parseFloat(getComputedStyle(section).getPropertyValue("--nav-h")) || 64;
    const p = Math.min(1, Math.max(0, (-r.top + navH) / span));
    if (Math.abs(p - scaleP) > 0.0005) setRows(p);
    if (!reduce) tickPipe(dt);
  });
  if (!reduce) {
    s.interval(() => {
      activeOut = (activeOut + 1) % OUTS.length;
      renderPipeStatic();
    }, 3200);
  }
});
</script>

<template>
  <section id="scale" ref="root" class="scale">
    <div class="scale-pin">
      <div class="wrap">
        <svg
          class="pipe"
          viewBox="-60 -730 1300 850"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        />
        <div class="counter">
          <h2>Same schema. Any size.</h2>
          <span class="rows">{{ rowsText }}</span>
          <div class="rows-sub">
            <span>rows in one sheet</span><b>{{ batchesText }}</b>
          </div>
          <div class="builder">
            <div class="bl" :class="{ on: mode === 'buffered' }">
              <code>createWorkbook()</code><span>buffered</span>
            </div>
            <div class="bl" :class="{ on: mode === 'stream' }">
              <code>createWorkbookStream()</code><span>streaming</span>
            </div>
            <div class="bs">
              <UIcon name="i-lucide-check" class="ic" /><code>schema: invoiceSchema</code
              ><span>unchanged</span>
            </div>
          </div>
        </div>
        <div class="stats">
          <div class="st-h">MEASURED ON THE STREAMING ENGINE</div>
          <div
            v-for="st in STATS"
            :key="st.k"
            class="st"
            :class="rowsNow >= st.at ? 'hit' : 'wait'"
          >
            <span class="k">{{ st.k }}</span>
            <span class="v"
              >{{ st.v }}<small>{{ st.u }}</small
              ><span v-if="st.v2" class="v2"
                >{{ st.v2 }}<small>{{ st.u2 }}</small></span
              ></span
            >
          </div>
          <p class="st-note">
            11 columns with styles, dates, formats and summaries, inline strings, 5,000-row batches.
            Node 24, Apple M5. Time and peak memory; 200k is the median of three runs.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
