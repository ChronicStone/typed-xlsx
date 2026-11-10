<script setup lang="ts">
import { ref } from "vue";
import { prefersReducedMotion, revealOnScroll, useWidget } from "./bp";

/**
 * Type safety block. Six scenarios each put one mistake in a schema, chart or pivot: the editor types
 * it, shows the error the library's types really produce, then fixes it, while the sheet on the right
 * shows what that column would have held without the check.
 */

const root = ref<HTMLElement | null>(null);

// Code is pre-highlighted with the landing's token classes. "@@" marks where the mistake is typed.
const fn = (name: string) => `<span class="t-fn">${name}</span>`;
const str = (text: string) => `<span class="t-str">"${text}"</span>`;
const key = (name: string) => `<span class="t-key">${name}</span>`;

const COLUMN_LINES: Record<string, string | string[]> = {
  customer: `  .${fn("column")}(${str("customer")}, { ${key("accessor")}: ${str("@@")} })`,
  qty: `  .${fn("column")}(${str("qty")}, { ${key("accessor")}: ${str("qty")} })`,
  price: `  .${fn("column")}(${str("price")}, { ${key("accessor")}: ${str("@@")} })`,
  total: [
    `  .${fn("column")}(${str("total")}, {`,
    `    ${key("formula")}: ({ refs }) =&gt;`,
    `      refs.${fn("column")}(${str("qty")}).${fn("mul")}(refs.${fn("column")}(${str("@@")})),`,
    "  })",
  ],
  paid: `  .${fn("column")}(${str("paid")}, { ${key("type")}: ${str("checkbox")}, ${key("accessor")}: ${str("@@")} })`,
};
const SCHEMA_HEAD = `<span class="t-kw">const</span> invoices = ${fn("createExcelSchema")}&lt;${fn("Invoice")}&gt;()`;
const DEFAULT_TOKENS: Record<string, string> = {
  customer: "customer.name",
  price: "unitPrice",
  total: "price",
  paid: "paid",
};
const schemaLines = (mistake: string) => [
  SCHEMA_HEAD,
  ...["customer", "qty", "price", "total", "paid"].flatMap((column) =>
    ([] as string[])
      .concat(COLUMN_LINES[column]!)
      .map((line) =>
        column === mistake ? line : line.replace("@@", DEFAULT_TOKENS[column] ?? ""),
      ),
  ),
  `  .${fn("build")}()`,
];
const SCHEMA_NOTE = '<span class="t-com">// invoices: customer, qty, price, total, paid</span>';

type Row = [customer: string, qty: number, price: number, paid: boolean];
const ROWS: Row[] = [
  ["Halvorsen", 12, 480, true],
  ["Okapi Health", 4, 1250, false],
  ["Brightwater", 30, 96, true],
  ["Tanaka", 8, 720, true],
  ["Pell Street", 6, 1875, false],
];
const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

type SheetColumn = {
  key: string;
  header: string;
  type: string;
  right?: boolean;
  checkbox?: boolean;
  cell: (row: Row) => string | number | boolean;
};
const COLUMNS: SheetColumn[] = [
  { key: "customer", header: "Customer", type: "text", cell: (r) => r[0] },
  { key: "qty", header: "Qty", type: "number", right: true, cell: (r) => r[1] },
  { key: "price", header: "Price", type: "currency", right: true, cell: (r) => usd(r[2]) },
  { key: "total", header: "Total", type: "formula", right: true, cell: (r) => usd(r[1] * r[2]) },
  { key: "paid", header: "Paid", type: "checkbox", checkbox: true, cell: (r) => r[3] },
];

type Scenario = {
  id: string;
  title: string;
  lines: () => string[];
  /** Index of the line holding the mistake. */
  act: number;
  bad: string;
  good: string;
  code: string;
  on: string;
  /** The message the types produce for this mistake (see packages/core/test/type-errors). */
  msg: string;
  fix?: string;
  /** Sheet column the mistake breaks, and what it would have held. */
  column?: string;
  ghost?: (row: Row) => string;
  extra?: "chart" | "pivot";
  litFields: string[];
  badField?: string;
  completions: Array<[string, string]>;
  why: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "typo",
    title: "A typo in a field",
    lines: () => schemaLines("price"),
    act: 3,
    bad: "untiPrice",
    good: "unitPrice",
    code: "TS2820",
    on: "accessor",
    msg: 'Type <code>"untiPrice"</code> is not assignable to type <code>"customer.name"</code> | <code>"qty"</code> | <code class="fit">"unitPrice"</code> | <code>"paid"</code>. Did you mean <code class="fit">"unitPrice"</code>?',
    fix: 'Change spelling to "unitPrice"',
    column: "price",
    ghost: () => "<s>(empty)</s>",
    litFields: ["unitPrice"],
    completions: [
      ["unitPrice", "number"],
      ["qty", "number"],
      ["customer.name", "string"],
      ["paid", "boolean"],
    ],
    why: "Without the check: an empty Price column.",
  },
  {
    id: "object",
    title: "An object in a cell",
    lines: () => schemaLines("customer"),
    act: 1,
    bad: "customer",
    good: "customer.name",
    code: "TS2322",
    on: "accessor",
    msg: '<code>customer</code> doesn\'t hold a cell value (string, number, boolean, Date, null or undefined). Fields that do: <code class="fit">customer.name</code>, <code>qty</code>, <code>unitPrice</code>, <code>paid</code>',
    column: "customer",
    ghost: () => "<s>[object Object]</s>",
    litFields: ["customer.name"],
    badField: "customer",
    completions: [["customer.name", "string"]],
    why: "Without the check: [object Object] in every row.",
  },
  {
    id: "checkbox",
    title: "A checkbox on a number",
    lines: () => schemaLines("paid"),
    act: 8,
    bad: "qty",
    good: "paid",
    code: "TS2322",
    on: "accessor",
    msg: '<code>qty</code> doesn\'t hold a boolean. Fields that do: <code class="fit">paid</code>',
    column: "paid",
    ghost: (r) => `<s>${r[1]}</s>`,
    litFields: ["paid"],
    badField: "qty",
    completions: [["paid", "boolean"]],
    why: "Without the check: numbers where checkboxes should be.",
  },
  {
    id: "formula",
    title: "A formula on a missing column",
    lines: () => schemaLines("total"),
    act: 6,
    bad: "unitPrice",
    good: "price",
    code: "TS2345",
    on: "refs.column",
    msg: 'Argument of type <code>"unitPrice"</code> is not assignable to parameter of type <code>"customer"</code> | <code>"qty"</code> | <code class="fit">"price"</code>.',
    column: "total",
    ghost: () => "<s>#REF!</s>",
    litFields: [],
    completions: [
      ["price", "column"],
      ["qty", "column"],
      ["customer", "column"],
    ],
    why: "Without the check: #REF! in the Total column.",
  },
  {
    id: "chart",
    title: "A chart on a text column",
    extra: "chart",
    lines: () => [
      SCHEMA_NOTE,
      `workbook.${fn("sheet")}(${str("Sales")})`,
      `  .${fn("table")}(${str("invoices")}, { schema: invoices, rows })`,
      `  .${fn("chart")}(${str("revenue")}, ({ refs }) =&gt; ({`,
      `    ${key("marks")}: [`,
      `      refs.${fn("table")}(${str("invoices")}).${fn("bar")}({`,
      `        ${key("x")}: ${str("customer")},`,
      `        ${key("y")}: ${str("@@")},`,
      "      }),",
      "    ],",
      "  }))",
    ],
    act: 7,
    bad: "customer",
    good: "total",
    code: "TS2322",
    on: "y",
    msg: '<code>customer</code> is not a numeric column. Numeric columns: <code>qty</code>, <code>price</code>, <code class="fit">total</code>',
    litFields: [],
    completions: [
      ["total", "number"],
      ["qty", "number"],
      ["price", "number"],
    ],
    why: "Without the check: a chart of text, every bar at zero.",
  },
  {
    id: "pivot",
    title: "A pivot summing text",
    extra: "pivot",
    lines: () => [
      SCHEMA_NOTE,
      `workbook.${fn("sheet")}(${str("Analysis")})`,
      `  .${fn("pivot")}(${str("byCustomer")}, ({ refs }) =&gt;`,
      `    refs.${fn("sheet")}(${str("Sales")}).${fn("table")}(${str("invoices")}).${fn("pivot")}({`,
      `      ${key("rows")}: [${str("customer")}],`,
      `      ${key("values")}: { ${key("customer")}: ${str("@@")} },`,
      "    }),",
      "  )",
    ],
    act: 5,
    bad: "sum",
    good: "count",
    code: "TS2322",
    on: "customer",
    msg: '<code>customer</code> is not numeric, so it can only be counted (<code class="fit">"count"</code>). Numeric columns: <code>qty</code>, <code>price</code>, <code>total</code>',
    litFields: [],
    completions: [["count", "aggregate"]],
    why: "Without the check: a pivot full of zeros.",
  },
];

const FIELDS: Array<{ name: string; type: string; cell: string | null }> = [
  { name: "customer", type: "{ name }", cell: null },
  { name: "customer.name", type: "string", cell: "text" },
  { name: "qty", type: "number", cell: "number" },
  { name: "unitPrice", type: "number", cell: "number" },
  { name: "paid", type: "boolean", cell: "checkbox" },
];

/** Time each scenario stays on screen, including the typing. */
const DURATION = 8200;

useWidget(root, (s) => {
  revealOnScroll(s);
  const reduce = prefersReducedMotion();
  const stage = s.$(".ty-stage");
  const editor = s.$(".ty-editor");
  const codeEl = s.$(".ty-code");
  const tip = s.$(".ty-tip");
  const completionsEl = s.$(".ty-ac");
  const steps = s.$(".ty-steps");
  steps.style.setProperty("--ty-dur", DURATION + "ms");

  let current = 0;
  type Phase = "typing" | "err" | "ac" | "ok";
  const isBroken = (phase: Phase) => phase === "err" || phase === "typing" || phase === "ac";

  function renderOutput(phase: Phase) {
    const c = SCENARIOS[current]!;
    const brokenKey = isBroken(phase) ? c.column : undefined;
    const popKey = phase === "ok" ? c.column : undefined;
    let html = "";
    for (const k of COLUMNS)
      html += `<div class="h${k.key === brokenKey ? " broken" : ""}">${k.header}</div>`;
    for (const k of COLUMNS)
      html += `<div class="t${k.key === brokenKey ? " broken" : ""}">${k.key === brokenKey ? "type error" : k.type}</div>`;
    ROWS.forEach((r, ri) =>
      COLUMNS.forEach((k) => {
        const cls = [
          k.right ? "r" : "",
          k.checkbox ? "cb" : "",
          k.key === brokenKey ? "broken" : "",
          k.key === popKey ? "pop" : "",
        ].join(" ");
        const style = k.key === popKey ? ` style="animation-delay:${ri * 90}ms"` : "";
        let value = k.checkbox ? `<span class="${k.cell(r) ? "on" : ""}"></span>` : k.cell(r);
        if (k.key === brokenKey && c.ghost) value = c.ghost(r);
        html += `<div class="${cls}"${style}>${value}</div>`;
      }),
    );
    s.$(".ty-sheet").innerHTML = html;

    const extra = s.$(".ty-extra");
    const extraBroken = !!(c.extra && isBroken(phase));
    extra.classList.toggle("broken", extraBroken);
    const why = (bad: boolean, text: string) =>
      `<div class="ty-why${bad ? " bad" : ""}">${text}</div>`;
    if (c.extra === "chart") {
      const totals = ROWS.map((r) => r[1] * r[2]);
      const max = Math.max(...totals);
      extra.innerHTML =
        `<div class="ty-extra-cap"><span>Chart · revenue</span><span>bar</span></div>` +
        `<div class="ty-bars">${totals.map((t) => `<i style="height:${Math.round((t / max) * 100)}%"></i>`).join("")}</div>` +
        why(extraBroken, extraBroken ? c.why : "Total by customer, as a native Excel chart.");
    } else if (c.extra === "pivot") {
      const rows = ROWS.slice(0, 3)
        .map((r) => `<div>${r[0]}</div><div class="pv">${extraBroken ? "0" : "1"}</div>`)
        .join("");
      extra.innerHTML =
        `<div class="ty-extra-cap"><span>Pivot · byCustomer</span><span>Analysis</span></div>` +
        `<div class="ty-ptable"><div class="ph">Customer</div><div class="ph pv">${extraBroken ? "Sum of customer" : "Count of customer"}</div>${rows}<div class="more">+ ${ROWS.length - 3} more</div><div class="pv more">…</div></div>` +
        why(extraBroken, extraBroken ? c.why : "One row per customer, counted.");
    } else {
      extra.innerHTML =
        `<div class="ty-extra-cap"><span>Contract</span><span>${ROWS.length} rows · 5 columns</span></div>` +
        why(
          !!brokenKey,
          brokenKey
            ? c.why
            : "Every column has a cell type, so the file is written exactly as declared.",
        );
    }
    s.$(".ty-out-bar .state").textContent = brokenKey || extraBroken ? "Not written" : "Written";
  }

  function build(i: number) {
    const c = SCENARIOS[i]!;
    current = i;
    s.$$(".ty-step").forEach((b) => {
      b.removeAttribute("aria-current");
      void b.offsetWidth; // restarts the progress bar
      if (Number(b.dataset.i) === i) b.setAttribute("aria-current", "true");
    });
    const active = s.$(`.ty-step[data-i="${i}"]`);
    if (active && steps.scrollWidth > steps.clientWidth)
      steps.scrollTo({
        left: active.parentElement!.offsetLeft - steps.offsetLeft,
        behavior: "smooth",
      });
    const tok =
      '<span class="ty-tok"><span class="txt"></span><span class="ty-caret"></span></span>';
    codeEl.innerHTML = c
      .lines()
      .map(
        (line, n) =>
          `<span class="ty-ln${n === c.act ? " act" : ""}" data-n="${n + 1}">${(line || " ").replace("@@", tok)}</span>`,
      )
      .join("");
    s.$(".ty-tip .code").textContent = c.code;
    s.$(".ty-tip .on b").textContent = c.on;
    s.$(".ty-tip .msg").innerHTML = c.msg;
    const fix = s.$(".ty-tip .fix");
    fix.style.display = c.fix ? "" : "none";
    if (c.fix) s.$(".ty-tip .fix-text").textContent = c.fix;
    completionsEl.innerHTML = c.completions
      .map(
        ([name, type], k) =>
          `<div class="${k === 0 ? "on" : ""}"><b>${name}</b><span>${type}</span></div>`,
      )
      .join("");
    s.$(".ty-status .pos").textContent = `Ln ${c.act + 1}`;
  }

  function setPhase(phase: Phase) {
    stage.classList.remove("is-typing", "is-err", "is-ac", "is-ok");
    stage.classList.add(`is-${phase}`);
    s.$(".ty-status .txt").textContent = phase === "err" ? "1 problem" : "No problems";
    const c = SCENARIOS[current]!;
    s.$$(".ty-field").forEach((field) => {
      field.classList.toggle("lit", phase === "err" && c.litFields.includes(field.dataset.f!));
      field.classList.toggle("bad", phase === "err" && c.badField === field.dataset.f);
    });
    renderOutput(phase);
    requestAnimationFrame(place);
  }

  function place() {
    const tok = codeEl.querySelector<HTMLElement>(".ty-tok");
    if (!tok) return;
    // Scroll sideways only when the mistake would be out of view (narrow screens).
    const inView = tok.offsetLeft + tok.offsetWidth < codeEl.clientWidth - 24;
    codeEl.scrollLeft = inView ? 0 : Math.max(0, tok.offsetLeft - 140);
    const er = editor.getBoundingClientRect();
    const tr = tok.getBoundingClientRect();
    const left = (w: number) => Math.max(12, Math.min(tr.left - er.left - 18, er.width - w - 12));
    tip.style.left = left(tip.offsetWidth) + "px";
    // Below the mistake, or above it when the card would cover the status bar.
    const below = tr.bottom - er.top + 16;
    const fitsBelow = below + tip.offsetHeight < er.height - 40;
    tip.style.top = (fitsBelow ? below : tr.top - er.top - tip.offsetHeight - 10) + "px";
    completionsEl.style.left = left(completionsEl.offsetWidth) + "px";
    completionsEl.style.top = tr.bottom - er.top + 6 + "px";
  }

  // Each run gets a token; starting another run (a click) makes the old one stop at its next wait.
  let token = 0;
  let hover = false;
  let visible = false;
  const isLive = (t: number) => t === token && !s.dead;
  const paused = (onHover: boolean) => (onHover && hover) || !visible;
  const wait = async (ms: number, t: number) => {
    await s.wait(ms);
    return isLive(t);
  };
  /** Waits while the block is off screen, and while it is hovered when `onHover` is set. */
  const hold = async (t: number, onHover = true) => {
    while (paused(onHover) && isLive(t)) await s.wait(200);
    return isLive(t);
  };
  const txt = () => codeEl.querySelector<HTMLElement>(".ty-tok .txt")!;

  async function run(i: number) {
    const t = ++token;
    const c = SCENARIOS[i]!;
    build(i);
    setPhase("typing");
    if (!(await hold(t, false)) || !(await wait(450, t))) return;
    for (let k = 1; k <= c.bad.length; k++) {
      txt().textContent = c.bad.slice(0, k);
      if (!(await wait(70, t))) return;
    }
    setPhase("err");
    if (!(await wait(3300, t)) || !(await hold(t))) return;
    setPhase("typing");
    for (let k = c.bad.length - 1; k >= 0; k--) {
      txt().textContent = c.bad.slice(0, k);
      if (!(await wait(26, t))) return;
    }
    setPhase("ac");
    if (!(await wait(900, t))) return;
    txt().textContent = c.good;
    setPhase("ok");
    codeEl.querySelector(".ty-ln.act")?.classList.add("flash");
    const rest = Math.max(1600, DURATION - 450 - c.bad.length * 96 - 3300 - 900);
    if (!(await wait(rest, t)) || !(await hold(t))) return;
    void run((i + 1) % SCENARIOS.length);
  }

  function show(i: number) {
    token++;
    build(i);
    txt().textContent = SCENARIOS[i]!.bad;
    setPhase("err");
  }

  s.on(steps, "click", (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".ty-step");
    if (!b) return;
    const i = Number(b.dataset.i);
    if (reduce) show(i);
    else void run(i);
  });
  s.on(stage, "mouseenter", () => {
    hover = true;
    s.root.classList.add("paused");
  });
  s.on(stage, "mouseleave", () => {
    hover = false;
    s.root.classList.remove("paused");
  });
  s.on(window, "resize", place);
  s.observe(stage, ([entry]) => (visible = !!entry?.isIntersecting), { threshold: 0.25 });

  if (reduce) {
    s.root.classList.add("static");
    show(1);
  } else {
    void run(0);
  }
});
</script>

<template>
  <section id="types" ref="root" class="sec tys">
    <div class="wrap">
      <div class="ty-head reveal">
        <div>
          <div class="ty-eyebrow">Type safety</div>
          <h2 class="h2">
            Typed against your data. <span class="accent">Can't break at runtime.</span>
          </h2>
        </div>
        <p class="lede">
          Your schema is checked against your row type, so typed-xlsx knows what every column
          serializes to before anything runs. Break the contract and it fails in your editor, with
          an error that tells you how to fix it.
        </p>
      </div>

      <div class="ty-stage reveal">
        <div class="ty-col data">
          <div class="ty-cap"><b>Your data</b> · serializes as</div>
          <div class="ty-data">
            <div class="ty-name"><i>type</i> <b>Invoice</b></div>
            <div v-for="f in FIELDS" :key="f.name" class="ty-field" :data-f="f.name">
              <span class="nm"
                >{{ f.name }}: <i>{{ f.type }}</i></span
              ><span class="as" :class="{ no: !f.cell }">{{ f.cell ?? "no cell" }}</span>
            </div>
            <div class="ty-note">
              An object has no cell type, so it can't be a column on its own.
            </div>
          </div>
        </div>
        <div class="ty-wire" />
        <div class="ty-col">
          <div class="ty-cap"><b>The contract</b> · your schema</div>
          <div class="ty-editor">
            <div class="ty-top">
              <span class="dots"><i /><i /><i /></span><span class="file">invoices.ts</span
              ><span class="lang">TypeScript</span>
            </div>
            <div class="ty-body"><div class="ty-code" /></div>
            <div class="ty-tip" role="status">
              <div class="hd">
                <span class="code" /><span class="on">on <b /></span>
              </div>
              <div class="msg" />
              <div class="fix"><span class="key">Quick fix</span><span class="fix-text" /></div>
            </div>
            <div class="ty-ac" />
            <div class="ty-status">
              <span class="st"><i /><span class="txt">No problems</span></span
              ><span class="pos">Ln 1</span>
            </div>
          </div>
        </div>
        <div class="ty-wire" />
        <div class="ty-col">
          <div class="ty-cap"><b>What Excel gets</b> · invoices.xlsx</div>
          <div class="ty-out">
            <div class="ty-out-bar"><span>Sheet1</span><span class="state">Written</span></div>
            <div class="ty-sheet" />
            <div class="ty-extra" />
          </div>
        </div>
      </div>

      <ul class="ty-steps reveal">
        <li v-for="(c, i) in SCENARIOS" :key="c.id">
          <button type="button" class="ty-step" :data-i="i">
            <span class="bar" /><span class="n">0{{ i + 1 }}</span
            ><span class="t">{{ c.title }}</span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
