<script setup lang="ts">
import { ref } from "vue";
import { hl, money, prefersReducedMotion, revealOnScroll, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);
type TypesState = "typing" | "error" | "ac" | "ok";
const state = ref<TypesState>("ok");
const typed = ref("unitPrice");

const ED = [
  "type Invoice = {",
  "  customer: { name: string }",
  "  qty: number",
  "  unitPrice: number",
  "}",
  "",
  "const invoices = createExcelSchema<Invoice>()",
  '  .column("customer", { accessor: "customer.name" })',
  '  .column("qty", { accessor: "qty" })',
  '  .column("unitPrice", { accessor: "unitPrice" })',
  '  .column("total", {',
  "    formula: ({ refs, fx }) =>",
  "      fx.round(@@Q@@.mul(@@U@@), 2),",
  '    summary: (s) => [s.formula("sum")],',
  "  })",
  "  .build()",
];
// line 13 is split around the two typed references so the typed token stays reactive
const LINES = ED.map((line, i) => {
  if (i !== 12) return { i, html: hl(line || " ") };
  const [pre, rest] = line.split("@@Q@@") as [string, string];
  const [mid, post] = rest.split("@@U@@") as [string, string];
  return { i, pre: hl(pre), q: hl('refs.column("qty")'), mid: hl(mid), post: hl(post) };
});

const MINI_ROWS: Array<[string, number, number]> = [
  ["Halvorsen Freight", 12, 480],
  ["Okapi Health", 4, 1250],
  ["Brightwater Labs", 30, 96.5],
  ["Tanaka Robotics", 8, 720],
];
const MINI_TOTAL = MINI_ROWS.reduce((s, d) => s + d[1] * d[2], 0);

useWidget(root, (s) => {
  revealOnScroll(s);
  const reduce = prefersReducedMotion();
  const editor = s.$(".editor");
  const tip = s.$(".tip");
  const ac = s.$(".ac");
  const typedEl = s.$(".typed");
  const tokU = s.$(".tok-u");

  function placePopups() {
    const er = editor.getBoundingClientRect();
    const tr = typedEl.getBoundingClientRect();
    const u = tokU.getBoundingClientRect();
    tip.style.left = Math.max(12, Math.min(u.left - er.left - 20, er.width - 480)) + "px";
    tip.style.top = tr.bottom - er.top + 10 + "px";
    ac.style.left = tr.left - er.left + "px";
    ac.style.top = tr.bottom - er.top + 8 + "px";
  }
  function drawRefBoxes() {
    (
      [
        ["B", ".rbox.a"],
        ["C", ".rbox.b"],
      ] as const
    ).forEach(([col, sel]) => {
      const cells = s.$$(`.mini [data-c="${col}"]`);
      const f = cells[0];
      const l = cells[cells.length - 1];
      if (!f || !l) return;
      Object.assign(s.$(sel).style, {
        left: f.offsetLeft + "px",
        top: f.offsetTop + "px",
        width: f.offsetWidth + "px",
        height: l.offsetTop + l.offsetHeight - f.offsetTop + "px",
      });
    });
  }
  function set(next: TypesState, text: string) {
    state.value = next;
    typed.value = text;
    requestAnimationFrame(() => {
      placePopups();
      drawRefBoxes();
    });
  }

  let visible = false;
  const isVisible = () => visible;
  s.observe(editor, ([en]) => (visible = !!en?.isIntersecting), { threshold: 0.25 });
  async function loop() {
    while (!s.dead) {
      while (!isVisible() && !s.dead) await s.wait(400);
      set("typing", "");
      await s.wait(700);
      const bad = "untiPrice";
      for (let i = 1; i <= bad.length; i++) {
        set("typing", bad.slice(0, i));
        await s.wait(85);
      }
      set("error", bad);
      await s.wait(2600);
      for (let i = bad.length - 1; i >= 0; i--) {
        set("typing", bad.slice(0, i));
        await s.wait(40);
      }
      set("ac", "");
      await s.wait(1100);
      set("ok", "unitPrice");
      await s.wait(4200);
    }
  }
  s.on(window, "resize", () => {
    placePopups();
    drawRefBoxes();
  });
  if (reduce) set("ok", "unitPrice");
  else void loop();
});
</script>

<template>
  <section id="types" ref="root" class="sec">
    <div class="wrap">
      <h2 class="h2 reveal">Wrong column?<br /><span class="accent">It won't compile.</span></h2>
      <p class="lede reveal">
        Accessors, formula references and summaries are checked against your row type. A typo fails
        in your editor, not in someone's spreadsheet.
      </p>
      <div class="types-grid">
        <div
          class="editor"
          :class="{ err: state === 'error', ok: state === 'ok', 'ac-open': state === 'ac' }"
        >
          <div class="ed-top">
            <UIcon name="i-lucide-file-code" class="ic" /><span class="file">invoice.schema.ts</span
            ><span class="ts">TypeScript 6.0</span>
          </div>
          <div class="ed-body">
            <template v-for="l in LINES" :key="l.i">
              <span v-if="l.html !== undefined" class="ln" v-html="l.html" />
              <span v-else class="ln act"
                ><span v-html="l.pre" /><span class="ref-a" v-html="l.q" /><span
                  v-html="l.mid" /><span class="tok-u ref-b"
                  ><span class="t-key">refs</span>.<span class="t-fn">column</span>(<span
                    class="t-str"
                    >"<span class="typed">{{ typed }}</span
                    ><span v-show="state === 'typing' || state === 'ac'" class="caret" />"</span
                  >)</span
                ><span v-html="l.post"
              /></span>
            </template>
          </div>
          <div class="tip">
            <b>TS2345</b> Argument of type <code>'"untiPrice"'</code> is not assignable to parameter
            of type <code>'"customer" | "qty" | "unitPrice"'</code>.
          </div>
          <div class="ac">
            <div><code>customer</code><span>string</span></div>
            <div><code>qty</code><span>number</span></div>
            <div class="on"><code>unitPrice</code><span>number</span></div>
          </div>
          <div class="ed-status">
            <span class="bad"><UIcon name="i-lucide-circle-x" class="ic" />1 problem</span
            ><span class="good"><UIcon name="i-lucide-circle-check" class="ic" />No problems</span
            ><span style="margin-left: auto">Ln 13, Col 52</span>
          </div>
        </div>
        <div
          class="xl"
          :class="{
            blocked: state === 'error' || state === 'typing' || state === 'ac',
            ok: state === 'ok',
          }"
        >
          <div class="xl-h">WHAT EXCEL RECEIVES</div>
          <div class="mini spec" style="width: 100%">
            <div class="sfbar">
              <span class="ref">D2</span><span class="fxs">fx</span
              ><span class="val mini-fx"
                >=ROUND(<span class="ra">B2</span>*<span class="rb">C2</span>,2)</span
              >
            </div>
            <div class="sgrid">
              <div
                v-for="(L, i) in ['', 'A', 'B', 'C', 'D']"
                :key="'h' + i"
                class="s lt"
                :style="{ gridRow: 1, gridColumn: i + 1 }"
              >
                {{ L }}
              </div>
              <div
                v-for="r in 6"
                :key="'r' + r"
                class="s rn"
                :style="{ gridRow: r + 1, gridColumn: 1 }"
              >
                {{ r }}
              </div>
              <div
                v-for="(h, i) in ['Customer', 'Qty', 'Unit price', 'Total']"
                :key="'hd' + i"
                class="s hd"
                :class="{ r: i > 0 }"
                :style="{ gridRow: 2, gridColumn: i + 2 }"
              >
                {{ h }}
              </div>
              <template v-for="(d, k) in MINI_ROWS" :key="d[0]">
                <div class="s" :style="{ gridRow: k + 3, gridColumn: 2 }">{{ d[0] }}</div>
                <div class="s r" data-c="B" :style="{ gridRow: k + 3, gridColumn: 3 }">
                  {{ d[1] }}
                </div>
                <div class="s r" data-c="C" :style="{ gridRow: k + 3, gridColumn: 4 }">
                  {{ money(d[2]) }}
                </div>
                <div class="s r" :style="{ gridRow: k + 3, gridColumn: 5 }">
                  {{ money(d[1] * d[2]) }}
                </div>
              </template>
              <div class="s sm" style="grid-row: 7; grid-column: 2">Total</div>
              <div class="s sm" style="grid-row: 7; grid-column: 3" />
              <div class="s sm" style="grid-row: 7; grid-column: 4" />
              <div class="s sm r" style="grid-row: 7; grid-column: 5">{{ money(MINI_TOTAL) }}</div>
              <div class="rbox a" />
              <div class="rbox b" />
            </div>
          </div>
          <div class="blocked-note">
            <UIcon name="i-lucide-ban" class="ic" /> tsc failed. No file was written.
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
