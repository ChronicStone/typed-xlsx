<script setup lang="ts">
import { ref } from "vue";
import { esc, prefersReducedMotion, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);
const rowsText = ref("1");
const batchesText = ref("one in-memory pass");
const mode = ref<"buffered" | "stream">("buffered");
const rowsNow = ref(1);
/** Memory over time, 0..1, drawn as a trace under the builder pills. */
const memPath = ref("");
const memNote = ref("grows with the file");

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
      code: { buffered: "the whole sheet, in memory", stream: "cells → sheet XML, per batch" },
    },
    {
      id: "spool",
      t: 590,
      w: 112,
      d: 80,
      h: 12,
      stack: 3,
      cap: "SPOOL",
      code: {
        buffered: "skipped: the sheet stays in memory",
        stream: "64 KiB chunks, backpressure",
      },
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
    // Buffered: the whole sheet goes from serialize to package in one piece, around the spool.
    let wires =
      scaleMode === "stream"
        ? `<polyline class="wire on" points="${pts([P(0, -40), P(0, -775)])}"/>`
        : `<polyline class="wire on" points="${pts([P(0, -40), P(0, -470)])}"/>` +
          `<polyline class="wire on bypass" points="${pts([P(0, -470), P(-95, -520), P(-95, -660), P(0, -715)])}"/>` +
          `<polyline class="wire" points="${pts([P(0, -470), P(0, -715)])}"/>` +
          `<polyline class="wire on" points="${pts([P(0, -715), P(0, -775)])}"/>`;
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
            nodes += box(
              0,
              -n.t,
              n.w,
              n.d,
              n.h,
              "node" + off + `" data-node="${n.id}" data-level="${k}`,
              k * (n.h + 7),
            );
        } else nodes += box(0, -n.t, n.w, n.d, n.h, "node" + off + `" data-node="${n.id}`);
      });
    let labels = NODES.map((n) => nodeLabel(n, scaleMode)).join("");
    OUTS.forEach((o) => {
      const [x, y] = P(o.o, -T_OUT - 70, 0);
      labels += `<text x="${x + 4}" y="${y + 2}">${esc(o.code)}</text>`;
    });
    pipe.innerHTML = `<g class="p-wires">${wires}</g><g class="p-packets"></g><g class="p-nodes">${nodes}</g><g class="p-labels">${labels}</g>`;
  }
  renderPipeStatic();

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
    memNote.value = m === "stream" ? "flat at any size" : "grows with the file";
    if (m !== scaleMode) {
      scaleMode = m;
      renderPipeStatic();
      resetFlow();
    }
  }
  const section = root.value!;
  s.observe(section, ([en]) => (visible = !!en?.isIntersecting));

  // ── Flow ──────────────────────────────────────────────────────────────────
  // Buffered runs one job at a time: the whole sheet is built in memory, packaged, then written.
  // Streaming is a pipeline: batches overlap, the spool fills and drains in 64 KiB chunks, the
  // output receives bytes while the source is still reading, and a full spool pauses the source.
  type Pt = readonly [number, number];
  const along = (path: readonly Pt[], f: number): Pt => {
    const lens = path.slice(1).map((pt, i) => Math.hypot(pt[0] - path[i]![0], pt[1] - path[i]![1]));
    let d = Math.max(0, Math.min(1, f)) * lens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i]! || i === lens.length - 1) {
        const a = path[i]!;
        const z = path[i + 1]!;
        const k = lens[i] ? Math.min(1, d / lens[i]!) : 1;
        return [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
      }
      d -= lens[i]!;
    }
    return path[path.length - 1]!;
  };
  const outPath = (k: number): Pt[] => {
    const o = OUTS[k]!.o;
    return [
      [0, -775],
      [0, -880],
      [o, -880],
      [o, -T_OUT],
    ];
  };
  const BYPASS: Pt[] = [
    [0, -420],
    [0, -470],
    [-95, -520],
    [-95, -660],
    [0, -715],
    [0, -775],
  ];
  const ease = (f: number) => (f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2);

  const PHASES = [
    ["load", 0.75],
    ["toCommit", 0.45],
    ["commit", 0.3],
    ["toXml", 0.4],
    ["build", 1.2],
    ["toZip", 0.8],
    ["zip", 0.55],
    ["ship", 0.6],
    ["rest", 0.8],
  ] as const;
  let phase = 0;
  let phaseT = 0;
  let batches: number[] = [];
  let chunks: number[] = [];
  let bytes: Array<{ s: number; k: number; big: boolean }> = [];
  let spool = 0;
  let drainAcc = 0;
  let spawnAcc = 0;
  let waiting = false;
  let mem = 0.06;
  let memAcc = 0;
  const memHist: number[] = Array.from({ length: 140 }, () => 0.06);

  function resetFlow() {
    phase = 0;
    phaseT = 0;
    batches = [];
    chunks = [];
    bytes = [];
    spool = 0;
    drainAcc = 0;
    spawnAcc = 0;
    waiting = false;
  }

  /** How much of the sheet the buffered path holds at its peak, by row count. */
  // Linear in rows: a few rows cost about what streaming does, 5,000 rows several times more.
  const peak = () => 0.12 + 0.78 * Math.min(1, rowsNow.value / 5000);

  function hot(id: string, on: boolean) {
    pipe.querySelectorAll(`[data-node="${id}"]`).forEach((el) => el.classList.toggle("hot", on));
  }
  function emit(k: number, big: boolean) {
    bytes.push({ s: 0, k, big });
  }
  function moveBytes(dt: number) {
    let g = "";
    bytes.forEach((b) => (b.s += dt * (b.big ? 1.25 : 1.8)));
    bytes = bytes.filter((b) => {
      if (b.s < 1) return true;
      const out = pipe.querySelector(`[data-out="${b.k}"]`);
      if (out) {
        out.classList.add("hit");
        s.timeout(() => out.classList.remove("hit"), b.big ? 420 : 140);
      }
      return false;
    });
    bytes.forEach((b) => {
      const [x, y] = along(outPath(b.k), b.s);
      g += b.big ? box(x, y, 34, 26, 14, "pk", 2) : box(x, y, 14, 14, 5, "pk", 2);
    });
    return g;
  }

  function tickBuffered(dt: number) {
    const [name, dur] = PHASES[phase]!;
    phaseT += dt;
    const f = Math.min(1, phaseT / dur);
    const e = ease(f);
    const p = peak();
    const slab = 8 + 18 * p;
    const sheet = Math.round(3 + 7 * p);
    let g = "";
    hot("src", name === "load");
    hot("commit", name === "commit");
    hot("xml", name === "build");
    hot("zip", name === "zip");
    if (name === "load") {
      g += box(0, -40, 92, 68, slab * e, "pk", 64);
      mem = 0.06 + 0.3 * p * e;
    } else if (name === "toCommit") g += box(0, -(40 + 210 * e), 74, 54, slab, "pk", 4);
    else if (name === "commit") g += box(0, -250, 74, 54, slab, "pk", 44);
    else if (name === "toXml") g += box(0, -(250 + 170 * e), 74, 54, slab, "pk", 4);
    else if (name === "build") {
      // the whole sheet is assembled in memory, row by row
      const n = Math.max(1, Math.ceil(e * sheet));
      for (let k = 0; k < n; k++) g += box(0, -420, 96, 66, 3, "ch", 44 + k * 5);
      mem = 0.06 + 0.3 * p + 0.6 * p * e;
    } else if (name === "toZip") {
      const [x, y] = along(BYPASS, e);
      for (let k = 0; k < sheet; k++) g += box(x, y, 80, 56, 3, "ch", 4 + k * 5);
    } else if (name === "zip") {
      const h = sheet * 5 * (1 - 0.6 * e);
      g += box(0, -775, 96, 70, Math.max(6, h), "ch", 84);
    } else if (name === "ship") {
      if (phaseT - dt <= 0) emit(activeOut, true);
      if (f >= 1) mem = 0.06;
    }
    g += moveBytes(dt);
    if (f >= 1) {
      phase = (phase + 1) % PHASES.length;
      phaseT = 0;
    }
    return g;
  }

  function tickStream(dt: number) {
    const rate = 1.1 + 5 * Math.max(0, (Math.log10(rowsNow.value) - 3.7) / (LOGMAX - 3.7));
    const speed = 300;
    const queueAt = 545;
    // the spool drains a 64 KiB chunk at a steady pace; a full spool pauses the source
    drainAcc += dt;
    if (drainAcc >= 0.32 && spool > 0) {
      drainAcc = 0;
      spool -= 1;
      chunks.push(590);
    }
    const queued = batches.filter((t) => t >= queueAt - 1).length;
    waiting = spool >= 3 && queued > 0;
    if (!waiting) {
      spawnAcc += dt * rate;
      if (spawnAcc >= 1 && batches.length < 12) {
        spawnAcc -= 1;
        batches.push(40);
      }
    }
    batches = batches.map((t, i) => {
      const ahead = batches[i - 1];
      const limit =
        spool >= 3 ? Math.min(queueAt, ahead !== undefined ? ahead - 24 : queueAt) : 9999;
      return Math.min(t + speed * dt, limit);
    });
    batches = batches.filter((t) => {
      if (t < 590) return true;
      spool = Math.min(3, spool + 1);
      return false;
    });
    chunks = chunks.map((t) => t + 360 * dt);
    let zipHot = false;
    chunks = chunks.filter((t) => {
      if (t < 775) return true;
      zipHot = true;
      emit(activeOut, false);
      return false;
    });
    hot("src", !waiting);
    hot(
      "commit",
      batches.some((t) => Math.abs(t - 250) < 45),
    );
    hot(
      "xml",
      batches.some((t) => Math.abs(t - 420) < 45),
    );
    if (zipHot) {
      hot("zip", true);
      s.timeout(() => hot("zip", false), 120);
    }
    pipe
      .querySelectorAll<SVGGElement>('[data-node="spool"]')
      .forEach((el) => el.classList.toggle("fill", Number(el.dataset.level) < spool));
    let g = "";
    batches.forEach((t) => {
      if (t < 420) g += box(0, -t, 54, 40, 9, "pk", 4);
      else for (let k = 0; k < 3; k++) g += box(0, -t, 38, 28, 3, "ch", 4 + k * 6);
    });
    chunks.forEach((t) => (g += box(0, -t, 34, 26, 3, "ch", 4)));
    g += moveBytes(dt);
    mem = 0.1 + 0.03 * batches.length + 0.04 * spool;
    return g;
  }

  function tickPipe(dt: number) {
    const g = scaleMode === "stream" ? tickStream(dt) : tickBuffered(dt);
    const pk = pipe.querySelector(".p-packets");
    if (pk) pk.innerHTML = g;
    memAcc += dt;
    if (memAcc >= 0.05) {
      memAcc = 0;
      memHist.push(Math.min(1, mem));
      memHist.shift();
      memPath.value = memHist
        .map(
          (v, i) =>
            `${i ? "L" : "M"}${((i / (memHist.length - 1)) * 240).toFixed(1)} ${(50 - v * 44).toFixed(1)}`,
        )
        .join(" ");
    }
  }

  let lastT = performance.now();
  setRows(0);

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
            <div class="mem" :class="mode">
              <div class="mem-h">
                <span>MEMORY</span><b>{{ memNote }}</b>
              </div>
              <svg viewBox="0 0 240 54" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" x2="240" y1="50.5" y2="50.5" class="mem-base" />
                <path :d="memPath" class="mem-line" />
              </svg>
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
