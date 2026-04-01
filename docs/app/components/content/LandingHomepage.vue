<script setup lang="ts">
import { codeToHtml } from "shiki";

const colorMode = useColorMode() as { value: string };
const isDark = computed(() => colorMode.value === "dark");

// ─── Shiki-rendered snippets ────────────────────────────────────────────────

const HERO_CODE = `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type Invoice = {
  id: string; customer: string;
  qty: number; unitPrice: number; taxRate: number;
  status: "paid" | "pending" | "overdue";
};

const schema = createExcelSchema<Invoice>()
  .column("id",       { header: "Invoice #",  accessor: "id" })
  .column("qty",      { header: "Qty",        accessor: "qty" })
  .column("price",    { header: "Unit Price", accessor: "unitPrice",
                        style: { numFmt: "$#,##0.00" } })
  // Type-checked formula refs — row.ref("qty") must be declared before this column
  .column("subtotal", {
    formula: ({ row, fx }) =>
      fx.round(row.ref("qty").mul(row.ref("price")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],   // ← live =SUM() footer row
  })
  .column("status", {
    accessor: "status",
    style: (row) => ({                    // ← full type inference on row
      font: {
        bold: row.status === "overdue",
        color: { rgb: row.status === "paid" ? "166534" : "B42318" },
      },
    }),
  })
  .build();

createWorkbook()
  .sheet("Invoices", { freezePane: { rows: 1 } })
  .table("invoices", { rows, schema });`;

type SnippetKey = "hero";
const renderedSnippets = useState<Record<SnippetKey, { dark: string; light: string }>>(
  "landing-hp-snippets",
  () => ({}) as Record<SnippetKey, { dark: string; light: string }>,
);

if (!renderedSnippets.value.hero) {
  const [dark, light] = await Promise.all([
    codeToHtml(HERO_CODE, { lang: "ts", theme: "github-dark" }),
    codeToHtml(HERO_CODE, { lang: "ts", theme: "github-light" }),
  ]);
  renderedSnippets.value = { hero: { dark, light } };
}

const heroHtml = computed(() =>
  isDark.value ? renderedSnippets.value.hero?.dark : renderedSnippets.value.hero?.light,
);

// ─── Static data ────────────────────────────────────────────────────────────

const stats = [
  { value: "0", unit: "", label: "Runtime dependencies", sub: "Custom OOXML + ZIP engine" },
  { value: "2", unit: "", label: "Schema modes", sub: "Report layout + native Excel tables" },
  { value: "60", unit: "", label: "Table style presets", sub: "Light, Medium, and Dark tiers" },
  { value: "4", unit: "", label: "Output targets", sub: "File, Buffer, Node stream, Web stream" },
] as const;

const architectureLayers = [
  {
    index: "01",
    title: "The Schema Layer",
    description:
      "Declare columns against your TypeScript row type. Typed dot-path and callback accessors, column selection, sub-row expansion, and per-cell styling all live here.",
    tags: ["accessor", "selection", "sub-rows", "cell style", "default value"],
    color: "text-primary",
    bar: "w-full",
  },
  {
    index: "02",
    title: "The Formula Engine",
    description:
      "Compose Excel formulas from column IDs, not cell addresses. Predecessor constraints are enforced by the TypeScript type system — forward references don't compile.",
    tags: ["row.ref()", "fx.round()", "fx.if()", "group.sum()", "summary.formula()"],
    color: "text-primary",
    bar: "w-4/5",
  },
  {
    index: "03",
    title: "The Workbook Builder",
    description:
      "Compose multi-sheet workbooks, place multiple tables per sheet with grid controls, choose report or native Excel table mode, and set freeze panes or RTL per sheet.",
    tags: ["report mode", "excel-table mode", "multi-sheet", "tablesPerRow", "freeze panes"],
    color: "text-primary",
    bar: "w-3/4",
  },
  {
    index: "04",
    title: "The Stream Pipeline",
    description:
      "Commit row batches to a file-backed spool. The ZIP is assembled incrementally — heap never holds the full dataset. Full feature parity with the buffered builder.",
    tags: ["table.commit()", "spool", "incremental ZIP", "pipeToNode()", "toReadableStream()"],
    color: "text-primary",
    bar: "w-2/3",
  },
] as const;

const featureGrid = [
  {
    icon: "i-lucide-table-2",
    title: "Native Excel Table Mode",
    body: "Real <table> objects — autoFilter, SUBTOTAL totals, 60 style presets.",
    to: "/excel-table-mode/overview",
  },
  {
    icon: "i-lucide-layers",
    title: "Dynamic Column Groups",
    body: "Runtime-generated columns with compile-time inferred context shape.",
    to: "/schema-builder/column-groups",
  },
  {
    icon: "i-lucide-sigma",
    title: "Reducer Summaries",
    body: "init / step / finalize accumulators — formula and cell summaries, streaming-compatible.",
    to: "/schema-builder/summaries",
  },
  {
    icon: "i-lucide-waves",
    title: "Streaming Builder",
    body: "Batch commits, flat memory at any dataset size, full feature parity.",
    to: "/streaming/overview",
  },
  {
    icon: "i-lucide-rows-4",
    title: "Sub-Row Expansion",
    body: "Array accessors expand to multiple rows — parent cells auto-merge.",
    to: "/schema-builder/defining-columns",
  },
  {
    icon: "i-lucide-palette",
    title: "Cell Styling",
    body: "Per-cell, per-row conditional styles — fonts, fills, borders, number formats.",
    to: "/schema-builder/cell-styling",
  },
] as const;

const routeCards = [
  {
    title: "Build your first report",
    description:
      "Invoice schema with formulas, summary row, conditional styling, and freeze pane in under 30 lines.",
    to: "/getting-started/quick-start-buffered",
    icon: "i-lucide-rocket",
    cta: "Buffered quick start",
  },
  {
    title: "Export 100k+ rows",
    description:
      "Same schema, streaming builder. Commit batches from a DB cursor and keep the heap flat.",
    to: "/getting-started/quick-start-streaming",
    icon: "i-lucide-waves",
    cta: "Streaming quick start",
  },
  {
    title: "Compare to SheetJS / ExcelJS",
    description:
      "Type safety, formula DSL, native tables, and schema reusability — side by side with the two most popular alternatives.",
    to: "/getting-started/comparison",
    icon: "i-lucide-git-compare-arrows",
    cta: "Library comparison",
  },
] as const;
</script>

<template>
  <div class="relative overflow-x-hidden">
    <!-- ──────────────────────────────────────────────────────────────
         HERO
    ────────────────────────────────────────────────────────────────── -->
    <div
      class="landing-hero-bg pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50rem]"
      aria-hidden="true"
    />

    <section
      class="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 px-4 pb-8 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12 lg:px-8 lg:pt-20"
    >
      <div class="flex flex-col gap-8 lg:pt-4">
        <UBadge
          color="primary"
          variant="subtle"
          class="w-fit rounded-full px-3 py-1 font-mono text-xs tracking-widest uppercase"
        >
          @chronicstone/typed-xlsx
        </UBadge>

        <h1
          class="text-balance text-5xl font-bold leading-[0.95] tracking-tight text-highlighted sm:text-6xl lg:text-[5.5rem]"
        >
          Excel&nbsp;Reporting<br /><em class="not-italic text-primary">Re-Engineered.</em>
        </h1>

        <p class="max-w-lg text-pretty text-xl leading-8 text-toned">
          Schema-driven XLSX generation for TypeScript. Typed accessors, a formula DSL with
          compile-time column references, native Excel tables, and a streaming builder for unbounded
          datasets.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            size="xl"
            to="/getting-started/quick-start-buffered"
            trailing-icon="i-lucide-arrow-right"
          >
            Build your first report
          </UButton>
          <UButton
            color="neutral"
            size="xl"
            variant="ghost"
            to="/getting-started/comparison"
            class="border border-default/60"
          >
            vs SheetJS / ExcelJS
          </UButton>
        </div>

        <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
          <code
            class="rounded-xl border border-default/50 bg-elevated/70 px-4 py-2.5 font-mono text-sm text-toned backdrop-blur"
          >
            npm install @chronicstone/typed-xlsx
          </code>
          <span class="flex items-center gap-2 text-sm text-toned">
            <span class="size-2 rounded-full bg-primary/80" />MIT license
          </span>
          <span class="flex items-center gap-2 text-sm text-toned">
            <span class="size-2 rounded-full bg-primary/80" />Zero dependencies
          </span>
        </div>
      </div>

      <UPageCard
        spotlight
        class="overflow-hidden rounded-[1.75rem] border border-default/60 bg-default/95 shadow-[0_32px_100px_-50px_rgba(0,0,0,0.5)]"
      >
        <div class="border-b border-default/60 px-5 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
                schema + formula + export
              </p>
              <p class="mt-0.5 text-sm font-semibold text-highlighted">
                Invoice report — full example
              </p>
            </div>
            <div class="flex gap-1.5">
              <span class="size-3 rounded-full bg-red-400/60" />
              <span class="size-3 rounded-full bg-amber-400/60" />
              <span class="size-3 rounded-full bg-green-400/60" />
            </div>
          </div>
        </div>
        <div class="landing-code-block max-h-[500px] overflow-auto px-4 py-4" v-html="heroHtml" />
      </UPageCard>
    </section>

    <!-- ──────────────────────────────────────────────────────────────
         STATS STRIP
    ────────────────────────────────────────────────────────────────── -->
    <div class="landing-stats-strip mx-auto mt-6 max-w-[90rem] px-4 sm:px-6 lg:px-8">
      <div
        class="grid grid-cols-2 divide-x divide-y divide-default/40 overflow-hidden rounded-2xl border border-default/40 bg-elevated/40 sm:grid-cols-4 sm:divide-y-0 backdrop-blur-sm"
      >
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="flex flex-col gap-1 px-4 py-4 sm:px-6 sm:py-5"
        >
          <p
            class="font-mono text-3xl font-bold tabular-nums text-highlighted leading-none sm:text-4xl"
          >
            {{ stat.value }}<span class="text-primary">{{ stat.unit }}</span>
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">{{ stat.label }}</p>
          <p class="text-xs leading-5 text-toned">{{ stat.sub }}</p>
        </div>
      </div>
    </div>

    <!-- ──────────────────────────────────────────────────────────────
         ARCHITECTURAL MONOLITH
    ────────────────────────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div
        class="mb-8 flex flex-col gap-4 sm:mb-10 lg:flex-row lg:items-end lg:justify-between lg:mb-12"
      >
        <div class="space-y-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
            Technical Blueprint
          </p>
          <h2
            class="max-w-2xl text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
          >
            The Architectural<br /><em class="not-italic text-primary">Monolith</em>
          </h2>
        </div>
        <p class="max-w-sm text-pretty text-base leading-7 text-toned">
          Four layers, one coherent system. Each layer builds on the previous. Stop at any layer —
          or use the full stack.
        </p>
      </div>

      <div class="rounded-[1.5rem] border border-default/40 bg-elevated/30 overflow-hidden">
        <div
          v-for="(layer, i) in architectureLayers"
          :key="layer.index"
          class="group grid grid-cols-1 gap-4 border-t border-default/40 px-5 py-5 transition-colors hover:bg-elevated/60 sm:px-6 sm:py-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:px-6 lg:py-7 first:border-t-0"
        >
          <!-- Index + title -->
          <div class="flex items-baseline gap-4">
            <span class="font-mono text-xs font-semibold tabular-nums text-primary/60">{{
              layer.index
            }}</span>
            <h3 class="text-base font-bold text-highlighted">{{ layer.title }}</h3>
          </div>

          <!-- Description + Tags: wrapper that becomes display:contents at lg so they each occupy a grid column -->
          <div class="flex flex-col gap-3 lg:contents">
            <!-- Description -->
            <p class="text-sm leading-6 text-toned">{{ layer.description }}</p>

            <!-- Tags + bar -->
            <div class="flex flex-col gap-3">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in layer.tags"
                  :key="tag"
                  class="rounded-full border border-default/60 bg-elevated/80 px-2.5 py-1 font-mono text-[11px] text-toned group-hover:border-primary/30 group-hover:text-highlighted transition-colors"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="h-[3px] rounded-full bg-elevated/80 overflow-hidden">
                <div
                  :class="[
                    'h-full rounded-full bg-primary/40 transition-all duration-500 group-hover:bg-primary/70',
                    layer.bar,
                  ]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ──────────────────────────────────────────────────────────────
         DEPTH SECTION
    ────────────────────────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
          Feature Surface
        </p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          Depth where reports<br />actually get <em class="not-italic text-primary">difficult.</em>
        </h2>
      </div>

      <!-- Before / After comparison -->
      <div
        class="grid grid-cols-1 gap-0 overflow-hidden rounded-[1.75rem] border border-default/60 lg:grid-cols-2"
      >
        <!-- Before -->
        <div
          class="relative flex flex-col border-b border-default/60 bg-elevated/20 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-8"
        >
          <div class="mb-5 flex items-center gap-3">
            <span class="flex size-6 items-center justify-center rounded-full bg-red-500/15">
              <UIcon name="i-lucide-x" class="size-3.5 text-red-400" />
            </span>
            <span class="font-mono text-xs font-semibold uppercase tracking-widest text-red-400/80"
              >Without typed-xlsx</span
            >
          </div>
          <pre
            class="depth-code flex-1 overflow-x-auto rounded-xl border border-red-500/15 bg-default/60 p-4 font-mono text-[0.72rem] leading-[1.85] sm:p-5 sm:text-[0.76rem]"
          ><code><span class="dc-comment">// Formula for a single cell — you write the string</span>
<span class="dc-kw">const</span> r = dataStartRow + i;
ws[<span class="dc-str">`D${r}`</span>] = {
  t: <span class="dc-str">"n"</span>,
  f: <span class="dc-str">`=ROUND(B${r}*C${r},2)`</span>,  <span class="dc-bad">// ← hardcoded B, C</span>
  z: <span class="dc-str">"$#,##0.00"</span>,
};

<span class="dc-comment">// Insert a column before B?</span>
<span class="dc-bad">// Re-audit every formula string by hand.</span>
<span class="dc-comment">// Row type changed? No error. Wrong value at runtime.</span>
<span class="dc-comment">// Summary row? Track the range yourself.</span></code></pre>
        </div>

        <!-- After -->
        <div class="relative flex flex-col bg-elevated/10 p-5 sm:p-6 lg:p-8">
          <div class="mb-5 flex items-center gap-3">
            <span class="flex size-6 items-center justify-center rounded-full bg-primary/15">
              <UIcon name="i-lucide-check" class="size-3.5 text-primary" />
            </span>
            <span class="font-mono text-xs font-semibold uppercase tracking-widest text-primary/80"
              >With typed-xlsx</span
            >
          </div>
          <pre
            class="depth-code flex-1 overflow-x-auto rounded-xl border border-primary/15 bg-default/60 p-4 font-mono text-[0.72rem] leading-[1.85] sm:p-5 sm:text-[0.76rem]"
          ><code><span class="dc-comment">// Reference columns by ID — addresses resolved at build time</span>
.<span class="dc-fn">column</span>(<span class="dc-str">"subtotal"</span>, {
  formula: ({ row, fx }) =>
    fx.<span class="dc-fn">round</span>(row.<span class="dc-fn">ref</span>(<span class="dc-str">"qty"</span>).<span class="dc-fn">mul</span>(row.<span class="dc-fn">ref</span>(<span class="dc-str">"price"</span>)), <span class="dc-num">2</span>),
  <span class="dc-comment">//               ↑ TypeScript error if "qty" or "price"</span>
  <span class="dc-comment">//                 aren't declared before this column</span>
  style: { numFmt: <span class="dc-str">"$#,##0.00"</span> },
  summary: (s) => [s.<span class="dc-fn">formula</span>(<span class="dc-str">"sum"</span>)],  <span class="dc-good">// ← live =SUM()</span>
})

<span class="dc-good">// Move columns freely — formulas shift automatically.</span>
<span class="dc-good">// Row type changed? TypeScript tells you before the build.</span></code></pre>
        </div>
      </div>

      <!-- 3 key guarantees under the code comparison -->
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <UPageCard
          v-for="item in [
            {
              icon: 'i-lucide-shield-check',
              label: 'Predecessor constraint',
              desc: 'row.ref() only compiles when the referenced column is declared earlier in the chain.',
            },
            {
              icon: 'i-lucide-move-horizontal',
              label: 'Column-order invariant',
              desc: 'Insert or remove columns freely — formula addresses shift automatically at build time.',
            },
            {
              icon: 'i-lucide-variable',
              label: 'Row type propagated',
              desc: 'Accessor callbacks and conditional styles carry full type inference from your T.',
            },
          ]"
          :key="item.label"
          spotlight
          class="rounded-[1.6rem] border border-default/60 bg-default/90"
        >
          <div class="flex h-full items-start gap-4 p-1">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 mt-0.5"
            >
              <UIcon :name="item.icon" class="size-4 text-primary" />
            </div>
            <div>
              <p class="text-sm font-bold text-highlighted">{{ item.label }}</p>
              <p class="mt-1 text-xs leading-5 text-toned">{{ item.desc }}</p>
            </div>
          </div>
        </UPageCard>
      </div>

      <!-- 6 feature tiles — minimal copy -->
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UPageCard
          v-for="card in featureGrid"
          :key="card.title"
          spotlight
          :to="card.to"
          class="rounded-[1.6rem] border border-default/60 bg-default/90"
        >
          <div class="flex h-full items-start gap-4 p-1">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 mt-0.5"
            >
              <UIcon :name="card.icon" class="size-4 text-primary" />
            </div>
            <div>
              <p class="text-sm font-bold text-highlighted">{{ card.title }}</p>
              <p class="mt-1 text-xs leading-5 text-toned">{{ card.body }}</p>
            </div>
          </div>
        </UPageCard>
      </div>
    </section>

    <!-- ──────────────────────────────────────────────────────────────
         EXAMPLE EXPLORER
    ────────────────────────────────────────────────────────────────── -->
    <div class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div
        class="mb-8 flex flex-col gap-4 sm:mb-10 lg:flex-row lg:items-end lg:justify-between lg:mb-10"
      >
        <div class="space-y-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
            Live Proofs
          </p>
          <h2
            class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
          >
            The Artifact<br /><em class="not-italic text-primary">Explorer.</em>
          </h2>
        </div>
        <p class="max-w-sm text-pretty text-base leading-7 text-toned">
          Five real examples — typed report, formula groups, Excel table mode, workbook composition,
          and streaming — each with a live workbook or output preview.
        </p>
      </div>
      <LandingExampleShowcase />
    </div>

    <!-- ──────────────────────────────────────────────────────────────
         STREAMING / SCALE
    ────────────────────────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div
        class="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-10"
      >
        <div class="flex flex-col gap-6 md:pt-2">
          <div class="space-y-3">
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
              Scale Layer
            </p>
            <h2
              class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
            >
              500k rows.<br />Flat memory.<br /><em class="not-italic text-primary"
                >Identical schema.</em
              >
            </h2>
          </div>
          <p class="max-w-lg text-pretty text-lg leading-8 text-toned">
            The streaming builder serializes each batch to a file-backed spool and assembles the ZIP
            incrementally. The same schema definitions — formula columns, table mode, groups,
            summaries — all work without a single change.
          </p>
          <div class="flex flex-wrap gap-3">
            <UButton
              color="primary"
              variant="soft"
              to="/streaming/overview"
              trailing-icon="i-lucide-arrow-right"
              size="lg"
            >
              Streaming overview
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              to="/getting-started/quick-start-streaming"
              class="border border-default/60"
              size="lg"
            >
              Quick start
            </UButton>
          </div>
        </div>

        <UPageCard
          spotlight
          class="min-w-0 overflow-hidden rounded-[1.75rem] border border-default/60 bg-elevated/50"
        >
          <div class="divide-y divide-default/40">
            <div class="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
              <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
                Stream Pipeline
              </p>
              <pre
                class="mt-3 min-w-0 overflow-x-auto whitespace-pre rounded-xl border border-default/50 bg-elevated/80 p-3 font-mono text-[0.7rem] leading-[1.75] text-toned sm:p-4 sm:text-[0.76rem]"
              ><code><span class="text-primary/80">const</span> workbook = <span class="text-highlighted">createWorkbookStream</span>();
<span class="text-primary/80">const</span> table = <span class="text-primary/60">await</span> workbook
  .<span class="text-highlighted">sheet</span>(<span class="text-amber-400/80">"Orders"</span>)
  .<span class="text-highlighted">table</span>(<span class="text-amber-400/80">"orders"</span>, { schema });

<span class="text-primary/60">for await</span> (<span class="text-primary/80">const</span> batch <span class="text-primary/60">of</span> fetchFromDB()) {
  <span class="text-primary/60">await</span> table.<span class="text-highlighted">commit</span>({ rows: batch });
  <span class="text-stone-500">// freed after each call — heap stays flat</span>
}

<span class="text-primary/60">await</span> workbook.<span class="text-highlighted">writeToFile</span>(<span class="text-amber-400/80">"./orders.xlsx"</span>);
<span class="text-stone-500">// or: pipeToNode(res) / pipeTo(writable)</span>
<span class="text-stone-500">// or: toNodeReadable() / toReadableStream()</span></code></pre>
            </div>

            <div class="grid grid-cols-2 divide-x divide-default/40">
              <div class="px-5 py-5">
                <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/60">
                  Buffered
                </p>
                <p class="mt-2 text-lg font-bold text-highlighted">~50k rows</p>
                <p class="mt-1 text-xs leading-5 text-toned">Synchronous, full dataset in heap</p>
              </div>
              <div class="px-5 py-5">
                <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/60">
                  Streaming
                </p>
                <p class="mt-2 text-lg font-bold text-primary">Unbounded</p>
                <p class="mt-1 text-xs leading-5 text-toned">Async commits, bounded memory</p>
              </div>
            </div>

            <div class="grid grid-cols-4 divide-x divide-default/40">
              <div
                v-for="item in ['File', 'Buffer', 'Node', 'Web']"
                :key="item"
                class="px-2 py-4 text-center sm:px-4"
              >
                <UIcon name="i-lucide-check" class="mx-auto size-4 text-primary" />
                <p class="mt-1.5 text-[10px] leading-4 text-toned sm:text-xs">{{ item }}</p>
              </div>
            </div>
          </div>
        </UPageCard>
      </div>
    </section>

    <!-- ──────────────────────────────────────────────────────────────
         NEXT STEPS
    ────────────────────────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div class="mb-8 space-y-3 sm:mb-10">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
          Entry Points
        </p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          Pick your<br /><em class="not-italic text-primary">starting point.</em>
        </h2>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <UPageCard
          v-for="card in routeCards"
          :key="card.title"
          :to="card.to"
          spotlight
          class="rounded-[1.75rem] border border-default/60 bg-default/95"
        >
          <div class="flex h-full flex-col gap-5 p-2">
            <div
              class="flex size-11 items-center justify-center rounded-full border border-primary/20 bg-primary/8"
            >
              <UIcon :name="card.icon" class="size-5 text-primary" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-highlighted">{{ card.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-toned">{{ card.description }}</p>
            </div>
            <div class="mt-auto flex items-center gap-1.5 text-sm font-semibold text-primary">
              {{ card.cta }}
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </div>
          </div>
        </UPageCard>
      </div>
    </section>

    <!-- ──────────────────────────────────────────────────────────────
         CTA
    ────────────────────────────────────────────────────────────────── -->
    <section
      class="mx-auto mb-16 mt-16 max-w-[90rem] px-4 sm:mb-24 sm:mt-24 sm:px-6 lg:mb-28 lg:mt-28 lg:px-8"
    >
      <div
        class="landing-cta-bg overflow-hidden rounded-[1.5rem] px-6 py-12 text-center sm:rounded-[2rem] sm:px-12 sm:py-16 lg:px-16 lg:py-20"
      >
        <p class="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
          Engineered for TypeScript
        </p>
        <h2
          class="mx-auto mb-5 max-w-3xl text-balance text-4xl font-bold tracking-tight text-highlighted sm:mb-6 sm:text-5xl lg:text-7xl"
        >
          Ready to<br /><em class="not-italic text-primary">compile?</em>
        </h2>
        <p class="mx-auto mb-8 max-w-lg text-pretty text-base text-toned sm:mb-10 sm:text-lg">
          Define a schema, pass rows, export a workbook. First report in under 30 lines. No
          configuration, no boilerplate.
        </p>
        <div class="flex flex-wrap justify-center gap-3 mb-8">
          <UButton
            color="primary"
            size="xl"
            to="/getting-started/quick-start-buffered"
            trailing-icon="i-lucide-arrow-right"
          >
            Build your first report
          </UButton>
          <UButton
            color="neutral"
            size="xl"
            variant="ghost"
            to="https://github.com/ChronicStone/typed-xlsx"
            target="_blank"
            icon="i-simple-icons-github"
            class="border border-default/60"
          >
            GitHub
          </UButton>
        </div>
        <div class="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <code
            class="rounded-xl border border-default/40 bg-elevated/60 px-5 py-2.5 font-mono text-sm text-toned backdrop-blur"
          >
            npm install @chronicstone/typed-xlsx
          </code>
          <span class="flex items-center gap-2 text-sm text-toned">
            <span class="size-2 rounded-full bg-primary/80" />MIT license
          </span>
          <span class="flex items-center gap-2 text-sm text-toned">
            <span class="size-2 rounded-full bg-primary/80" />Zero dependencies
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-hero-bg {
  background:
    radial-gradient(
      ellipse 80% 50% at 50% -10%,
      color-mix(in oklab, var(--ui-primary) 18%, transparent),
      transparent
    ),
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--ui-bg-elevated) 70%, transparent) 0%,
      transparent 100%
    );
}

.landing-code-block :deep(pre) {
  margin: 0;
  border-radius: 0;
  border: none;
  background: transparent !important;
  padding: 0;
  overflow-x: auto;
}

.landing-code-block :deep(code) {
  font-size: 0.78rem;
  line-height: 1.8;
}

.landing-code-block :deep(.line) {
  white-space: pre;
  min-height: 1.6em;
}

.landing-stats-strip .grid > div:nth-child(n + 3) {
  border-top: none;
}

.depth-code {
  tab-size: 2;
  white-space: pre;
}

/* Prevent streaming code card from blowing out its container */
.stream-code {
  white-space: pre;
}

/* Shared syntax palette for the before/after panels */
.depth-code .dc-kw {
  color: rgb(147 197 253 / 0.75);
} /* blue — keywords */
.depth-code .dc-fn {
  color: rgb(125 211 252 / 0.8);
} /* sky — function calls */
.depth-code .dc-str {
  color: rgb(251 191 36 / 0.8);
} /* amber — strings */
.depth-code .dc-num {
  color: rgb(196 181 253 / 0.8);
} /* violet — numbers */
.depth-code .dc-comment {
  color: rgb(120 113 108 / 1);
} /* stone — neutral comments */
.depth-code .dc-bad {
  color: rgb(248 113 113 / 0.7);
} /* red — problem annotations */
.depth-code .dc-good {
  color: color-mix(in oklab, var(--ui-primary) 70%, transparent);
} /* primary — positive annotations */

.landing-cta-bg {
  background:
    radial-gradient(
      ellipse 100% 80% at 50% 100%,
      color-mix(in oklab, var(--ui-primary) 10%, transparent),
      transparent
    ),
    color-mix(in oklab, var(--ui-bg-elevated) 60%, var(--ui-bg));
  border: 1px solid color-mix(in oklab, var(--ui-border) 50%, transparent);
}
</style>
