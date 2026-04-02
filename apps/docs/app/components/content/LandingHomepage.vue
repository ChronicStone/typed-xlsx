<script setup lang="ts">
const HERO_CODE = `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type Invoice = {
  id: string;
  customer: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  status: "paid" | "pending" | "overdue";
};

const schema = createExcelSchema<Invoice>()
  .column("id", {
    header: "Invoice #",
    accessor: "id",
  })
  .column("qty", {
    header: "Qty",
    accessor: "qty",
  })
  .column("price", {
    header: "Unit Price",
    accessor: "unitPrice",
    style: { numFmt: "$#,##0.00" },
  })
  // Type-checked formula refs — row.ref("qty") must be declared before this column
  .column("subtotal", {
    formula: ({ row, fx }) =>
      fx.round(row.ref("qty").mul(row.ref("price")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  .column("status", {
    accessor: "status",
    style: (row) => ({
      font: {
        bold: row.status === "overdue",
        color: {
          rgb: row.status === "paid" ? "166534" : "B42318",
        },
      },
    }),
  })
  .build();

createWorkbook()
  .sheet("Invoices", { freezePane: { rows: 1 } })
  .table("invoices", { rows, schema });`;

const stats = [
  { value: "0", unit: "", label: "Runtime dependencies", sub: "Custom OOXML + ZIP engine" },
  { value: "2", unit: "", label: "Schema modes", sub: "Report layout + native Excel tables" },
  { value: "60", unit: "", label: "Table style presets", sub: "Light, Medium, and Dark tiers" },
  { value: "4", unit: "", label: "Output targets", sub: "File, Buffer, Node stream, Web stream" },
] as const;

const valueProps = [
  {
    icon: "i-lucide-shield-check",
    title: "Type-safe schema",
    description:
      "Declare columns against your TS row type. Typed accessors, sub-row expansion, and per-cell styling with full inference — no casting.",
  },
  {
    icon: "i-lucide-braces",
    title: "Formula DSL",
    description:
      "Reference columns by ID, not cell address. Forward references don't compile. Move columns freely — formulas shift automatically.",
  },
  {
    icon: "i-lucide-table-2",
    title: "Two schema modes",
    description:
      "Report layout or real Excel table objects with SUBTOTAL() totals, structured refs, and 60 built-in style presets.",
  },
  {
    icon: "i-lucide-columns-2",
    title: "Dynamic column groups",
    description:
      "Generate column groups from runtime inputs with typed group context. Group-scoped sum/avg aggregates stay declarative.",
  },
  {
    icon: "i-lucide-zap",
    title: "Streaming pipeline",
    description:
      "Commit row batches to a file-backed spool. Heap stays flat regardless of dataset size. Full schema parity with buffered mode.",
  },
  {
    icon: "i-lucide-package-open",
    title: "Zero dependencies",
    description:
      "Custom OOXML serializer and incremental ZIP engine. No SheetJS, no ExcelJS. No transitive risk in your dependency graph.",
  },
] as const;

const apiSurface = [
  {
    label: "Schema",
    hint: "Define typed columns, formulas, styles",
    code: `createExcelSchema<T>(options?)
  .column(id, {
    accessor, formula,
    style, summary,
    validation, selected,
  })
  .group(id, (group, ctx) => { ... })
  .subRows(key, (sub) => { ... })
  .build()`,
  },
  {
    label: "Workbook",
    hint: "Compose sheets, flush to output",
    code: `createWorkbook()
  .sheet(name, {
    freezePane, rtl,
    tablesPerRow,
  })
  .table(name, {
    schema, rows,
    context, mode,
  })
  .writeToFile(path)`,
  },
  {
    label: "Streaming",
    hint: "Same schema, unbounded row output",
    code: `const wb = createWorkbookStream();

const tbl = await wb
  .sheet(name)
  .table(name, { schema });

for await (const batch of cursor) {
  await tbl.commit({ rows: batch });
}

await wb.writeToFile(path);`,
  },
] as const;

const architectureLayers = [
  {
    index: "01",
    title: "The Schema Layer",
    description:
      "Model worksheet structure directly from your TypeScript rows. Accessors, selection, sub-rows, defaults, and styling all stay in one schema surface.",
    tags: ["typed accessors", "selection", "sub-rows", "styles", "defaults"],
    bar: "w-full",
  },
  {
    index: "02",
    title: "The Formula Engine",
    description:
      "Compose Excel formulas from column IDs instead of coordinates. Predecessor rules are enforced at compile time, so broken references fail before export.",
    tags: ["row.ref()", "fx.*", "group sums", "summary formulas", "compile-time safety"],
    bar: "w-4/5",
  },
  {
    index: "03",
    title: "The Workbook Builder",
    description:
      "Assemble complete workbooks with multi-sheet layout, report mode or native Excel tables, freeze panes, and predictable table placement.",
    tags: ["report mode", "excel tables", "multi-sheet", "layout", "freeze panes"],
    bar: "w-3/4",
  },
  {
    index: "04",
    title: "The Stream Pipeline",
    description:
      "Commit large exports in batches to a spool-backed pipeline. The ZIP is assembled incrementally, while the schema surface stays aligned with buffered mode.",
    tags: ["batch commit", "spool", "incremental ZIP", "Node streams", "Web streams"],
    bar: "w-2/3",
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

const bufferedCode = `const wb = createWorkbook()
  .sheet("Orders", { freezePane: { rows: 1 } })
  .table("orders", { schema, rows });

await wb.writeToFile("./orders.xlsx");
// or: .toBuffer() / .pipeToNode(res)`;

const streamingCode = `const wb = createWorkbookStream();

const tbl = await wb
  .sheet("Orders")
  .table("orders", { schema });

for await (const batch of db.cursor()) {
  await tbl.commit({ rows: batch });
}

await wb.writeToFile("./orders.xlsx");`;
</script>

<template>
  <div class="relative overflow-x-hidden">
    <!-- ── HERO ─────────────────────────────────────────────────────── -->
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

      <!-- Hero code card -->
      <UPageCard spotlight class="rounded-[1.75rem] border border-default/60">
        <div class="overflow-hidden rounded-[1.75rem]">
          <div class="border-b border-default/60 px-5 py-3.5">
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
          <MdcCodeBlock
            :code="HERO_CODE"
            lang="ts"
            theme="vitesse-dark"
            class="landing-code-block max-h-[480px] overflow-auto px-4 py-3"
          />
        </div>
      </UPageCard>
    </section>

    <!-- ── STATS STRIP ───────────────────────────────────────────────── -->
    <div
      class="landing-stats-strip mx-auto mt-14 max-w-[90rem] px-4 sm:mt-16 sm:px-6 lg:mt-20 lg:px-8"
    >
      <div
        class="grid grid-cols-2 divide-x divide-y divide-default/40 overflow-hidden rounded-2xl border border-default/40 bg-elevated/40 backdrop-blur-sm sm:grid-cols-4 sm:divide-y-0"
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

    <!-- ── WHY TYPED-XLSX ─────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-20 sm:px-6 lg:mt-24 lg:px-8">
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
          Why typed-xlsx
        </p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          The right primitives for<br /><em class="not-italic text-primary"
            >serious TypeScript reporting.</em
          >
        </h2>
      </div>

      <div
        class="grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] border border-default/40 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="prop in valueProps"
          :key="prop.title"
          class="group bg-elevated/20 px-5 py-5 transition-colors hover:bg-elevated/40 sm:px-6 sm:py-6"
        >
          <div
            class="mb-4 flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/8 transition-colors group-hover:bg-primary/12"
          >
            <UIcon :name="prop.icon" class="size-4 text-primary" />
          </div>
          <h3 class="text-sm font-bold text-highlighted">{{ prop.title }}</h3>
          <p class="mt-1.5 text-sm leading-6 text-toned">{{ prop.description }}</p>
        </div>
      </div>
    </section>

    <!-- ── API SURFACE ───────────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-20 sm:px-6 lg:mt-24 lg:px-8">
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">API surface</p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          Three functions.<br /><em class="not-italic text-primary">The whole library.</em>
        </h2>
      </div>

      <div
        class="grid grid-cols-1 items-stretch divide-y divide-default/40 overflow-hidden rounded-[1.5rem] border border-default/40 bg-elevated/20 lg:grid-cols-3 lg:divide-x lg:divide-y-0"
      >
        <div
          v-for="entry in apiSurface"
          :key="entry.label"
          class="flex flex-col gap-3 px-6 py-6 sm:px-7 sm:py-7"
        >
          <div class="flex items-baseline gap-3">
            <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
              {{ entry.label }}
            </p>
            <p class="text-xs text-toned/50">{{ entry.hint }}</p>
          </div>
          <MdcCodeBlock
            :code="entry.code"
            lang="ts"
            theme="vitesse-dark"
            class="api-code-block flex-1 overflow-hidden rounded-xl border border-default/40 bg-default/60 p-4"
          />
        </div>
      </div>
    </section>

    <!-- ── FEATURE CAROUSEL ──────────────────────────────────────────── -->
    <LandingValueCarousel />

    <!-- ── ARCHITECTURAL MONOLITH ────────────────────────────────────── -->
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
          Four layers, one coherent system. Each builds on the previous — stop at any layer or use
          the full stack.
        </p>
      </div>

      <div class="overflow-hidden rounded-[1.5rem] border border-default/40 bg-elevated/30">
        <div
          v-for="layer in architectureLayers"
          :key="layer.index"
          class="group grid grid-cols-1 gap-4 border-t border-default/40 px-5 py-5 transition-colors hover:bg-elevated/60 sm:px-6 sm:py-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:px-6 lg:py-7 first:border-t-0"
        >
          <div class="flex items-baseline gap-4">
            <span class="font-mono text-xs font-semibold tabular-nums text-primary/60">{{
              layer.index
            }}</span>
            <h3 class="text-base font-bold text-highlighted">{{ layer.title }}</h3>
          </div>

          <div class="flex flex-col gap-3 lg:contents">
            <p class="text-sm leading-6 text-toned">{{ layer.description }}</p>

            <div class="flex flex-col gap-3">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in layer.tags"
                  :key="tag"
                  class="rounded-full border border-default/60 bg-elevated/80 px-2.5 py-1 font-mono text-[11px] text-toned transition-colors group-hover:border-primary/30 group-hover:text-highlighted"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="h-[3px] overflow-hidden rounded-full bg-elevated/80">
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

    <!-- ── ARTIFACT SHOWCASE TEASER ──────────────────────────────────── -->
    <div class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div
        class="mb-8 flex flex-col gap-4 sm:mb-10 lg:flex-row lg:items-end lg:justify-between lg:mb-12"
      >
        <div class="space-y-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">Showcase</p>
          <h2
            class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
          >
            Real outputs from<br /><em class="not-italic text-primary">real schemas.</em>
          </h2>
        </div>
        <div class="flex items-end">
          <UButton
            to="/playground"
            color="primary"
            variant="soft"
            trailing-icon="i-lucide-arrow-right"
            size="lg"
          >
            Explore all artifacts
          </UButton>
        </div>
      </div>
      <LandingArtifactExplorerPreview :limit="3" :show-cta="false" />
    </div>

    <!-- ── STREAMING / SCALE ──────────────────────────────────────────── -->
    <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">Scale Layer</p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          One schema.<br /><em class="not-italic text-primary">Two output paths.</em>
        </h2>
        <p class="max-w-xl text-pretty text-lg leading-8 text-toned">
          Switch from buffered to streaming without touching the schema. The same column
          definitions, formulas, and table modes work in both paths.
        </p>
      </div>

      <div class="overflow-hidden rounded-[1.75rem] border border-default/60">
        <div class="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch">
          <!-- Buffered -->
          <div
            class="flex min-h-[24rem] flex-col border-b border-default/60 bg-elevated/20 px-5 py-6 sm:min-h-[25rem] sm:px-7 sm:py-7 lg:border-b-0 lg:border-r"
          >
            <div class="mb-4 flex items-center gap-3">
              <span
                class="rounded-full border border-default/50 bg-elevated/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-toned"
                >Buffered</span
              >
              <span class="text-xs text-toned/60">up to ~50k rows</span>
            </div>
            <div class="flex flex-1">
              <MdcCodeBlock
                :code="bufferedCode"
                lang="ts"
                theme="vitesse-dark"
                class="stream-code-block stream-code-block--buffered"
              />
            </div>
          </div>

          <!-- Streaming -->
          <div
            class="flex min-h-[24rem] flex-col bg-elevated/10 px-5 py-6 sm:min-h-[25rem] sm:px-7 sm:py-7"
          >
            <div class="mb-4 flex items-center gap-3">
              <span
                class="rounded-full border border-primary/30 bg-primary/8 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary"
                >Streaming</span
              >
              <span class="text-xs text-toned/60">unbounded — heap stays flat</span>
            </div>
            <div class="flex flex-1">
              <MdcCodeBlock
                :code="streamingCode"
                lang="ts"
                theme="vitesse-dark"
                class="stream-code-block stream-code-block--streaming"
              />
            </div>
          </div>
        </div>

        <!-- Stat strip -->
        <div
          class="grid grid-cols-2 divide-x divide-default/40 border-t border-default/40 sm:grid-cols-4"
        >
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Schema</p>
            <p class="mt-1.5 text-sm font-bold text-highlighted">Unchanged</p>
            <p class="mt-0.5 text-xs text-toned">Same definition in both modes</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Heap</p>
            <p class="mt-1.5 text-sm font-bold text-primary">Flat</p>
            <p class="mt-0.5 text-xs text-toned">Freed after each batch commit</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Dataset</p>
            <p class="mt-1.5 text-sm font-bold text-primary">Unbounded</p>
            <p class="mt-0.5 text-xs text-toned">File-backed incremental ZIP</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Outputs</p>
            <p class="mt-1.5 text-sm font-bold text-highlighted">File · Buffer · Node · Web</p>
            <p class="mt-0.5 text-xs text-toned">All 4 targets available</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── NEXT STEPS ────────────────────────────────────────────────── -->
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

    <!-- ── FINAL CTA ─────────────────────────────────────────────────── -->
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
        <div class="flex flex-wrap justify-center gap-3">
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

.api-code-block :deep(pre),
.stream-code-block :deep(pre) {
  margin: 0;
  border: 0;
  background: transparent !important;
  padding: 0;
  overflow-x: auto;
}

.api-code-block :deep(code),
.stream-code-block :deep(code) {
  font-size: 0.72rem;
  line-height: 1.85;
}

.api-code-block :deep(.line),
.stream-code-block :deep(.line) {
  white-space: pre;
  min-height: 1.6em;
}

.stream-code-block {
  display: block;
  flex: 1 1 auto;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border-radius: 0.75rem;
  padding: 1rem;
}

.stream-code-block :deep(.shiki) {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 100%;
}

.stream-code-block--buffered {
  border: 1px solid color-mix(in oklab, var(--ui-border) 55%, transparent);
  background: color-mix(in oklab, var(--ui-bg) 92%, transparent);
}

.stream-code-block--streaming {
  border: 1px solid color-mix(in oklab, var(--ui-primary) 18%, transparent);
  background: color-mix(in oklab, var(--ui-bg) 92%, transparent);
}

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
