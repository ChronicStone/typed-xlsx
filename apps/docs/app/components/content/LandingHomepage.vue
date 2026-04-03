<script setup lang="ts">
import { motion } from "motion-v";
import { stagger } from "motion";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// ── Shared animation presets ────────────────────────────────────
const fadeUp = { opacity: 0, y: 24 } as const;
const visible = { opacity: 1, y: 0 } as const;
const ease = [0.16, 1, 0.3, 1] as const;

const inViewOnce = { once: true, amount: 0.08, margin: "0px 0px -60px 0px" } as const;
const hoverTransition = { duration: 0.22, ease } as const;

// ── Variants for stagger children (value props, api panels, arch rows, route cards) ──
const staggerParent = {
  hidden: {},
  show: {
    transition: {
      delayChildren: stagger(0.07),
    },
  },
} as const;

const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
} as const;

const HERO_CODE = `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type Invoice = {
  id: string;
  customer: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  status: "paid" | "pending" | "overdue";
};

declare const rows: Invoice[];
// ---cut---
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
  // Type-checked formula refs — refs.column("qty") must be declared before this column
  .column("subtotal", {
    formula: ({ refs, fx }) =>
      fx.round(refs.column("qty").mul(refs.column("price")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  // TypeScript fails if you reference a later column
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
  {
    value: "0",
    unit: "",
    label: "Runtime dependencies",
    sub: "Custom OOXML + ZIP engine — nothing to audit",
  },
  { value: "2", unit: "", label: "Schema modes", sub: "Report layout or native Excel tables" },
  {
    value: "60",
    unit: "",
    label: "Table style presets",
    sub: "Light, Medium & Dark tiers built in",
  },
  { value: "4", unit: "", label: "Output targets", sub: "File, Buffer, Node stream & Web stream" },
] as const;

const animatedStats = ref(stats.map(() => 0));
const statsEntered = ref(false);

const statsDisplay = computed(() =>
  stats.map((stat, index) => ({
    ...stat,
    displayValue: `${animatedStats.value[index] ?? 0}`,
  })),
);

let statsRafId: number | undefined;

let statsTimeoutId: ReturnType<typeof setTimeout> | undefined;

function animateStats() {
  if (statsEntered.value) return;
  statsEntered.value = true;

  const start = performance.now();
  const duration = 900;

  const tick = (now: number) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;

    animatedStats.value = stats.map((stat) => {
      const target = Number.parseInt(stat.value, 10);
      return Number.isFinite(target) ? Math.round(target * eased) : 0;
    });

    if (progress < 1) {
      statsRafId = requestAnimationFrame(tick);
      return;
    }

    statsRafId = undefined;
  };

  statsRafId = requestAnimationFrame(tick);
}

onMounted(() => {
  statsTimeoutId = setTimeout(() => {
    animateStats();
  }, 250);
});

onBeforeUnmount(() => {
  if (statsTimeoutId !== undefined) clearTimeout(statsTimeoutId);
  if (statsRafId !== undefined) cancelAnimationFrame(statsRafId);
});

const valueProps = [
  {
    icon: "i-lucide-shield-check",
    title: "Type-safe schema",
    description:
      "Declare columns against your row type. Accessors, path validation, sub-row expansion, and per-cell styling are all checked at compile time — shape drift is caught before export.",
  },
  {
    icon: "i-lucide-braces",
    title: "Formula DSL",
    description:
      "Reference columns by ID, never by cell address. Forward references won't compile, so broken formula wiring is a TypeScript error — not a silent Excel bug.",
  },
  {
    icon: "i-lucide-table-2",
    title: "Two schema modes",
    description:
      "Emit classic report layouts or real Excel table objects complete with SUBTOTAL() totals, structured refs, and 60 built-in style presets.",
  },
  {
    icon: "i-lucide-columns-2",
    title: "Dynamic column groups",
    description:
      "Generate columns from runtime data with fully inferred context. Missing or mistyped group context is a compile-time error, not a runtime surprise.",
  },
  {
    icon: "i-lucide-zap",
    title: "Streaming pipeline",
    description:
      "Commit rows in batches through a spool-backed pipeline. Heap stays flat no matter the dataset size — with full schema parity to buffered mode.",
  },
  {
    icon: "i-lucide-package-open",
    title: "Zero dependencies",
    description:
      "Ships a custom OOXML serializer and incremental ZIP engine. No SheetJS, no ExcelJS — zero transitive risk in your dependency graph.",
  },
] as const;

const apiSurface = [
  {
    label: "Schema",
    hint: "Typed columns, formulas & styles",
    code: `createExcelSchema<T>(options?)
  .column(id, {
    accessor, formula,
    style, summary,
    validation,
  })
  .group(id, (group, ctx) => { ... })
  // Array accessors expand rows automatically
  .build()`,
  },
  {
    label: "Workbook",
    hint: "Sheets, tables & output in one chain",
    code: `createWorkbook()
  .sheet(name, {
    freezePane, rightToLeft,
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
    hint: "Same schema, unbounded datasets",
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
      "Model your worksheet directly from TypeScript row types. Accessors, selection, sub-rows, defaults, and styling live in a single declarative surface.",
    tags: ["typed accessors", "selection", "sub-rows", "styles", "defaults"],
    bar: "w-full",
  },
  {
    index: "02",
    title: "The Formula Engine",
    description:
      "Compose Excel formulas from column IDs, not coordinates. Predecessor ordering is enforced at compile time — broken references never reach the spreadsheet.",
    tags: ["refs.column()", "fx.*", "group sums", "summary formulas", "compile-time safety"],
    bar: "w-4/5",
  },
  {
    index: "03",
    title: "The Workbook Builder",
    description:
      "Assemble multi-sheet workbooks with report mode or native Excel tables, freeze panes, and deterministic table placement — all from a single fluent chain.",
    tags: ["report mode", "excel tables", "multi-sheet", "layout", "freeze panes"],
    bar: "w-3/4",
  },
  {
    index: "04",
    title: "The Stream Pipeline",
    description:
      "Flush large exports in batches through a spool-backed pipeline. The ZIP is assembled incrementally while the schema surface stays identical to buffered mode.",
    tags: ["batch commit", "spool", "incremental ZIP", "Node streams", "Web streams"],
    bar: "w-2/3",
  },
] as const;

const routeCards = [
  {
    title: "Build your first report",
    description:
      "Typed accessors, formula refs, a summary row, and a freeze pane — in under 30 lines of code.",
    to: "/getting-started/quick-start",
    icon: "i-lucide-rocket",
    cta: "Quick start",
  },
  {
    title: "Explore the schema API",
    description:
      "Columns, formulas, groups, sub-rows, styling, and validation — the full schema surface explained.",
    to: "/schema-builder/defining-columns",
    icon: "i-lucide-layers",
    cta: "Schema builder",
  },
  {
    title: "Compare to SheetJS / ExcelJS",
    description:
      "Type safety, formula DSL, native tables, and schema reuse — side by side with the two most popular alternatives.",
    to: "/getting-started/comparison",
    icon: "i-lucide-git-compare-arrows",
    cta: "Library comparison",
  },
] as const;

const bufferedCode = `const wb = createWorkbook()
  .sheet("Orders", { freezePane: { rows: 1 } })
  .table("orders", { schema, rows });

await wb.writeToFile("./orders.xlsx");
// or: const bytes = wb.toBuffer()`;

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
        <div class="landing-hero-step" style="--hero-delay: 0ms">
          <UBadge
            color="primary"
            variant="subtle"
            class="w-fit rounded-full px-3 py-1 font-mono text-xs tracking-widest uppercase"
          >
            @chronicstone/typed-xlsx
          </UBadge>
        </div>

        <div class="landing-hero-step" style="--hero-delay: 40ms">
          <h1
            class="text-balance text-5xl font-bold leading-[0.95] tracking-tight text-highlighted sm:text-6xl lg:text-[5.5rem]"
          >
            Excel&nbsp;Reporting<br /><em class="not-italic text-primary">Re-Engineered.</em>
          </h1>
        </div>

        <div class="landing-hero-step" style="--hero-delay: 80ms">
          <p class="max-w-lg text-pretty text-xl leading-8 text-toned">
            Schema-driven XLSX generation for TypeScript. If the export definition is wrong, the
            compiler tells you — not the spreadsheet.
          </p>
        </div>

        <div
          class="landing-hero-step flex flex-wrap items-center gap-3"
          style="--hero-delay: 120ms"
        >
          <UButton
            color="primary"
            size="xl"
            to="/getting-started/introduction"
            trailing-icon="i-lucide-arrow-right"
          >
            Get started
          </UButton>
          <UButton
            color="neutral"
            size="xl"
            variant="ghost"
            to="/getting-started/comparison"
            class="border border-default/60"
          >
            Why typed-xlsx?
          </UButton>
        </div>

        <div
          class="landing-hero-step flex flex-wrap items-center gap-x-6 gap-y-3"
          style="--hero-delay: 160ms"
        >
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
      <div class="landing-hero-step" style="--hero-delay: 100ms">
        <UPageCard spotlight class="min-w-0 rounded-[1.75rem] border border-default/60">
          <div class="min-w-0 overflow-hidden rounded-[1.75rem]">
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
              twoslash
              theme="vitesse-dark"
              class="landing-code-block min-w-0 max-h-[480px] overflow-y-auto overflow-x-hidden px-4 py-3"
            />
          </div>
        </UPageCard>
      </div>
    </section>

    <!-- ── STATS STRIP ───────────────────────────────────────────────── -->
    <motion.div
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease, delay: 0.12 }"
      class="landing-stats-strip mx-auto mt-14 max-w-[90rem] px-4 sm:mt-16 sm:px-6 lg:mt-20 lg:px-8"
    >
      <motion.div
        :variants="staggerParent"
        initial="hidden"
        whileInView="show"
        :inViewOptions="inViewOnce"
        class="landing-section-container grid grid-cols-2 divide-x divide-y divide-default/40 overflow-hidden rounded-2xl sm:grid-cols-4 sm:divide-y-0"
      >
        <motion.div
          v-for="stat in statsDisplay"
          :key="stat.label"
          :variants="staggerChild"
          :whileHover="{ y: -3, scale: 1.01 }"
          :transition="hoverTransition"
          class="landing-stat-item flex flex-col gap-1 px-4 py-4 sm:px-6 sm:py-5"
        >
          <p
            class="font-mono text-3xl font-bold tabular-nums text-highlighted leading-none sm:text-4xl"
          >
            {{ stat.displayValue }}<span class="text-primary">{{ stat.unit }}</span>
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">{{ stat.label }}</p>
          <p class="text-xs leading-5 text-toned">{{ stat.sub }}</p>
        </motion.div>
      </motion.div>
    </motion.div>

    <!-- ── WHY TYPED-XLSX ─────────────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-20 sm:px-6 lg:mt-24 lg:px-8"
    >
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

      <motion.div
        :variants="staggerParent"
        initial="hidden"
        whileInView="show"
        :inViewOptions="inViewOnce"
        class="landing-section-container grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] sm:grid-cols-2 lg:grid-cols-3"
      >
        <motion.div
          v-for="prop in valueProps"
          :key="prop.title"
          :variants="staggerChild"
          :whileHover="{ y: -4 }"
          :transition="hoverTransition"
          class="group landing-value-card px-5 py-5 transition-colors sm:px-6 sm:py-6"
        >
          <div
            class="mb-4 flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/8 transition-colors group-hover:bg-primary/12"
          >
            <UIcon :name="prop.icon" class="size-4 text-primary" />
          </div>
          <h3 class="text-sm font-bold text-highlighted">{{ prop.title }}</h3>
          <p class="mt-1.5 text-sm leading-6 text-toned">{{ prop.description }}</p>
        </motion.div>
      </motion.div>
    </motion.section>

    <!-- ── API SURFACE ───────────────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-20 sm:px-6 lg:mt-24 lg:px-8"
    >
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">API surface</p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          Three functions.<br /><em class="not-italic text-primary">The whole library.</em>
        </h2>
      </div>

      <motion.div
        :variants="staggerParent"
        initial="hidden"
        whileInView="show"
        :inViewOptions="inViewOnce"
        class="landing-section-container grid grid-cols-1 items-stretch divide-y divide-default/40 overflow-hidden rounded-[1.5rem] lg:grid-cols-3 lg:divide-x lg:divide-y-0"
      >
        <motion.div
          v-for="entry in apiSurface"
          :key="entry.label"
          :variants="staggerChild"
          :whileHover="{ y: -4 }"
          :transition="hoverTransition"
          class="landing-api-card flex flex-col gap-3 px-6 py-6 sm:px-7 sm:py-7"
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
        </motion.div>
      </motion.div>
    </motion.section>

    <!-- ── FEATURE CAROUSEL ──────────────────────────────────────────── -->
    <LandingValueCarousel />

    <!-- ── ARCHITECTURAL MONOLITH ────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8"
    >
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
          Four layers, one coherent system. Each builds on the last — stop at any layer or use the
          full stack.
        </p>
      </div>

      <motion.div
        :variants="staggerParent"
        initial="hidden"
        whileInView="show"
        :inViewOptions="inViewOnce"
        class="landing-section-container overflow-hidden rounded-[1.5rem]"
      >
        <motion.div
          v-for="layer in architectureLayers"
          :key="layer.index"
          :variants="staggerChild"
          class="group grid grid-cols-1 gap-4 border-t border-default/40 px-5 py-5 transition-colors sm:px-6 sm:py-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:px-6 lg:py-7 first:border-t-0 landing-arch-row"
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
        </motion.div>
      </motion.div>
    </motion.section>

    <!-- ── ARTIFACT SHOWCASE TEASER ──────────────────────────────────── -->
    <motion.div
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8"
    >
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
      <motion.div
        :initial="{ opacity: 0, y: 18 }"
        :whileInView="{ opacity: 1, y: 0 }"
        :inViewOptions="inViewOnce"
        :transition="{ duration: 0.55, ease, delay: 0.08 }"
      >
        <LandingArtifactExplorerPreview :limit="3" :show-cta="false" />
      </motion.div>
    </motion.div>

    <!-- ── STREAMING / SCALE ──────────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8"
    >
      <div class="mb-8 space-y-3 sm:mb-10 lg:mb-12">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">Scale Layer</p>
        <h2
          class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
        >
          One schema.<br /><em class="not-italic text-primary">Two output paths.</em>
        </h2>
        <p class="max-w-xl text-pretty text-lg leading-8 text-toned">
          Switch from buffered to streaming without touching your schema. Column definitions,
          formulas, summaries, validation, and table modes all carry over unchanged.
        </p>
      </div>

      <div class="landing-section-container overflow-hidden rounded-[1.75rem]">
        <div class="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch">
          <!-- Buffered -->
          <motion.div
            :initial="{ opacity: 0, x: -18 }"
            :whileInView="{ opacity: 1, x: 0 }"
            :inViewOptions="inViewOnce"
            :transition="{ duration: 0.5, ease, delay: 0.04 }"
            :whileHover="{ y: -4 }"
            class="landing-stream-panel flex min-h-[24rem] flex-col border-b border-default/60 px-5 py-6 sm:min-h-[25rem] sm:px-7 sm:py-7 lg:border-b-0 lg:border-r landing-buffered-panel"
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
          </motion.div>

          <!-- Streaming -->
          <motion.div
            :initial="{ opacity: 0, x: 18 }"
            :whileInView="{ opacity: 1, x: 0 }"
            :inViewOptions="inViewOnce"
            :transition="{ duration: 0.5, ease, delay: 0.1 }"
            :whileHover="{ y: -4 }"
            class="landing-stream-panel flex min-h-[24rem] flex-col px-5 py-6 sm:min-h-[25rem] sm:px-7 sm:py-7 landing-streaming-panel"
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
          </motion.div>
        </div>

        <!-- Stat strip -->
        <div
          class="grid grid-cols-2 divide-x divide-default/40 border-t border-default/40 sm:grid-cols-4"
        >
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Schema</p>
            <p class="mt-1.5 text-sm font-bold text-highlighted">Unchanged</p>
            <p class="mt-0.5 text-xs text-toned">Identical definition in both modes</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Heap</p>
            <p class="mt-1.5 text-sm font-bold text-primary">Flat</p>
            <p class="mt-0.5 text-xs text-toned">Released after every batch commit</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Dataset</p>
            <p class="mt-1.5 text-sm font-bold text-primary">Unbounded</p>
            <p class="mt-0.5 text-xs text-toned">Spool-backed incremental ZIP</p>
          </div>
          <div class="px-5 py-4 sm:px-6 sm:py-5">
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-toned/60">Outputs</p>
            <p class="mt-1.5 text-sm font-bold text-highlighted">File · Buffer · Node · Web</p>
            <p class="mt-0.5 text-xs text-toned">
              Buffered: file/buffer. Streaming: file/Node/Web.
            </p>
          </div>
        </div>
      </div>
    </motion.section>

    <!-- ── NEXT STEPS ────────────────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
      class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8"
    >
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
      <motion.div
        :variants="staggerParent"
        initial="hidden"
        whileInView="show"
        :inViewOptions="inViewOnce"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
      >
        <motion.div
          v-for="card in routeCards"
          :key="card.title"
          :variants="staggerChild"
          :whileHover="{ y: -4 }"
          :transition="{ type: 'spring', stiffness: 420, damping: 28 }"
        >
          <UPageCard :to="card.to" spotlight class="landing-route-card rounded-[1.75rem]">
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
                <UIcon name="i-lucide-arrow-right" class="landing-route-arrow size-4" />
              </div>
            </div>
          </UPageCard>
        </motion.div>
      </motion.div>
    </motion.section>

    <!-- ── FINAL CTA ─────────────────────────────────────────────────── -->
    <motion.section
      :initial="fadeUp"
      :whileInView="visible"
      :inViewOptions="inViewOnce"
      :transition="{ duration: 0.7, ease }"
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
          Define a schema, pass your rows, export a workbook. Your first report ships in under 30
          lines — no configuration, no boilerplate.
        </p>
        <motion.div
          :initial="{ opacity: 0, y: 16 }"
          :whileInView="{ opacity: 1, y: 0 }"
          :inViewOptions="inViewOnce"
          :transition="{ duration: 0.45, ease, delay: 0.08 }"
          class="flex flex-wrap justify-center gap-3"
        >
          <motion.div :whileHover="{ y: -3, scale: 1.02 }" :transition="hoverTransition">
            <UButton
              color="primary"
              size="xl"
              to="/getting-started/quick-start"
              trailing-icon="i-lucide-arrow-right"
              class="landing-cta-button"
            >
              Build your first report
            </UButton>
          </motion.div>
          <motion.div :whileHover="{ y: -3, scale: 1.02 }" :transition="hoverTransition">
            <UButton
              color="neutral"
              size="xl"
              variant="ghost"
              to="https://github.com/ChronicStone/typed-xlsx"
              target="_blank"
              icon="i-simple-icons-github"
              class="landing-cta-button border border-default/60"
            >
              GitHub
            </UButton>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  </div>
</template>

<style scoped>
/* ── Hero background ──────────────────────────────────────────── */
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

.landing-hero-step {
  opacity: 0;
  animation: landing-hero-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--hero-delay, 0ms);
  will-change: opacity;
}

@keyframes landing-hero-fade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-hero-step {
    opacity: 1;
    animation: none;
  }
}

/* ── Light mode: stronger hero gradient ───────────────────────── */
:root:not(.dark) .landing-hero-bg {
  background:
    radial-gradient(
      ellipse 80% 50% at 50% -10%,
      color-mix(in oklab, var(--ui-primary) 12%, transparent),
      transparent
    ),
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--ui-bg-elevated) 90%, transparent) 0%,
      transparent 100%
    );
}

/* Hero code block — single vertical scroll on wrapper, horizontal on <pre> */
.landing-code-block {
  scrollbar-width: none; /* Firefox */
}

.landing-code-block::-webkit-scrollbar {
  display: none; /* Chrome / Safari / Edge */
}

.landing-code-block :deep(pre) {
  margin: 0;
  border-radius: 0;
  border: none;
  background: transparent !important;
  padding: 0;
  overflow-x: auto;
  min-width: 0;
  max-width: 100%;
  scrollbar-width: none;
}

.landing-code-block :deep(pre)::-webkit-scrollbar {
  display: none;
}

.landing-code-block :deep(code) {
  font-size: 0.78rem;
  line-height: 1.8;
  display: inline-block;
  min-width: 100%;
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

/* ── CTA background ───────────────────────────────────────────── */
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

/* ── Light mode CTA — more contrast ──────────────────────────── */
:root:not(.dark) .landing-cta-bg {
  background:
    radial-gradient(
      ellipse 100% 80% at 50% 100%,
      color-mix(in oklab, var(--ui-primary) 8%, transparent),
      transparent
    ),
    color-mix(in oklab, var(--ui-bg-elevated) 100%, var(--ui-bg));
  border-color: color-mix(in oklab, var(--ui-border) 80%, transparent);
}

/* ── Light mode: stronger card/section backgrounds ────────────── */
:root:not(.dark) .light-card-contrast {
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, var(--ui-bg) 30%);
}

:root:not(.dark) .light-border-contrast {
  border-color: color-mix(in oklab, var(--ui-border) 70%, transparent);
}

/* ── Micro-interactions: button hover glow ────────────────────── */
:deep(.landing-btn-glow) {
  position: relative;
  overflow: hidden;
}

:deep(.landing-btn-glow::after) {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.3s ease;
  background: radial-gradient(
    circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    color-mix(in oklab, var(--ui-primary) 20%, transparent),
    transparent 70%
  );
  pointer-events: none;
}

:deep(.landing-btn-glow:hover::after) {
  opacity: 1;
}

/* ── Landing section containers — theme-aware surface ─────────── */
.landing-section-container {
  background: var(--landing-surface);
  border: 1px solid var(--landing-border);
  transition: border-color 0.2s ease;
}

/* ── Value prop cards ─────────────────────────────────────────── */
.landing-value-card {
  background: var(--landing-surface);
  transition: background 0.2s ease;
}

.landing-value-card:hover {
  background: var(--landing-surface-hover);
}

/* ── Stats cards ──────────────────────────────────────────────── */
.landing-stat-item {
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.landing-stat-item:hover {
  background: color-mix(in oklab, var(--landing-surface-hover) 82%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ui-primary) 10%, transparent);
}

/* ── API cards ───────────────────────────────────────────────── */
.landing-api-card {
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.landing-api-card:hover {
  background: color-mix(in oklab, var(--landing-surface-hover) 88%, transparent);
}

/* ── Architecture rows ────────────────────────────────────────── */
.landing-arch-row {
  transition: background 0.2s ease;
}

.landing-arch-row:hover {
  background: var(--landing-surface-hover);
}

/* ── Streaming panels ─────────────────────────────────────────── */
.landing-buffered-panel {
  background: var(--landing-surface);
}

.landing-streaming-panel {
  background: color-mix(in oklab, var(--landing-surface) 60%, transparent);
}

.landing-stream-panel {
  transition:
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.landing-stream-panel:hover {
  box-shadow: 0 16px 42px -28px color-mix(in oklab, var(--ui-primary) 18%, transparent);
}

/* ── Route cards ──────────────────────────────────────────────── */
.landing-route-card {
  border: 1px solid var(--landing-border);
  background: var(--landing-surface);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.landing-route-card:hover {
  border-color: var(--landing-border-hover);
  box-shadow: 0 8px 32px -12px color-mix(in oklab, var(--ui-primary) 12%, transparent);
}

.landing-route-card:hover .landing-route-arrow {
  transform: translateX(3px);
}

.landing-route-arrow {
  transition: transform 0.2s ease;
}

.landing-cta-button {
  box-shadow: 0 10px 26px -18px color-mix(in oklab, var(--ui-primary) 24%, transparent);
}
</style>
