<script setup lang="ts">
const colorMode = useColorMode();

type ValueStoryCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  docsPath: string;
  beforeCode: string;
  afterCode: string;
};

const DURATION = 10_000;

const stories: ValueStoryCard[] = [
  {
    id: "formula-refs",
    eyebrow: "Formula DSL",
    title: "Column IDs replace fragile cell addresses",
    body: "Write formulas against column IDs and let the engine resolve final Excel coordinates. Rearranging columns is a layout decision, not a formula maintenance event.",
    docsPath: "/formulas/formula-columns",
    beforeCode:
      "// SheetJS: every formula is a string tied to a cell address\n" +
      "const r = dataStartRow + i;\n" +
      "ws[\n" +
      "  `D${r}`\n" +
      "] = {\n" +
      '  t: "n",\n' +
      "  f: `=ROUND(B${r}*C${r},2)`,\n" +
      '  z: "$#,##0.00",\n' +
      "};\n\n" +
      "// Insert a column before B?\n" +
      "// Re-audit every formula string by hand.\n" +
      "// Row type changed? No error. Wrong value at runtime.",
    afterCode: `// Reference columns by ID — addresses resolved at build time
.column("subtotal", {
  formula: ({ row, fx }) =>
    fx.round(row.ref("qty").mul(row.ref("price")), 2),
  // TypeScript error if "qty" or "price"
  // aren't declared before this column
  style: { numFmt: "$#,##0.00" },
  summary: (s) => [s.formula("sum")],
});

// Move columns freely — formulas shift automatically.
// Row type changes fail before export.`,
  },
  {
    id: "summary-rows",
    eyebrow: "Summary formulas",
    title: "Footer totals without range arithmetic",
    body: "Attach SUM, AVERAGE, or any aggregate directly to the schema. Ranges resolve automatically — no string templates to maintain when the report grows.",
    docsPath: "/formulas/summary-formulas",
    beforeCode:
      "// SheetJS: totals row is manual range math\n" +
      "const last = dataStartRow + rows.length - 1;\n" +
      "ws[\n" +
      "  `E${last + 2}`\n" +
      "] = {\n" +
      "  f: `SUM(E${dataStartRow}:E${last})`,\n" +
      '  z: "$#,##0.00",\n' +
      "};\n\n" +
      "// Range is a hardcoded string template.\n" +
      "// Move a column and update the formula manually.",
    afterCode: `.column("revenue", {
  accessor: "revenue",
  style: { numFmt: "$#,##0.00" },
  summary: (s) => [s.formula("sum")],
})
.column("margin", {
  formula: ({ row, fx }) =>
    fx.round(row.ref("revenue").sub(row.ref("cost")), 2),
  summary: (s) => [s.formula("average")],
});

// Footer ranges resolve from the schema engine.
// No string arithmetic required.`,
  },
  {
    id: "dynamic-columns",
    eyebrow: "Dynamic groups",
    title: "Runtime-driven columns with typed context",
    body: "Generate column groups from runtime data while formulas, totals, and context stay strongly typed. The schema surface stays clean regardless of how many columns are generated.",
    docsPath: "/schema-builder/column-groups",
    beforeCode: `// SheetJS: runtime columns mean manual header + cell loops
let col = 1;
for (const region of regions) {
  ws[XLSX.utils.encode_cell({ r: 0, c: col })] = {
    v: region,
    t: "s",
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    ws[XLSX.utils.encode_cell({ r: rowIndex + 1, c: col })] = {
      v: rows[rowIndex]?.revenueByRegion?.[region] ?? 0,
      t: "n",
    };
  }

  col += 1;
}

// Dynamic layout logic leaks into worksheet mutation.`,
    afterCode: `const schema = createExcelSchema<Row>()
  .column("account", { accessor: "account" })
  .group("regions", (group, regions: string[]) => {
  for (const region of regions) {
    group.column(region, {
      header: region,
      accessor: (row) => row.revenueByRegion[region] ?? 0,
    });
  }
})
.column("regionalTotal", {
  formula: ({ row }) => row.group("regions").sum(),
});

workbook.sheet("Regional revenue").table("revenue", {
  rows,
  schema,
  context: { regions },
});

// Runtime columns stay inside the schema surface.`,
  },
  {
    id: "sub-rows",
    eyebrow: "Sub-row expansion",
    title: "Nested records without manual row offsets",
    body: "Return an array from an accessor and child rows expand automatically. Parent columns merge, formula references stay coherent — no offset bookkeeping required.",
    docsPath: "/schema-builder/defining-columns",
    beforeCode: `// SheetJS: flatten parent/child rows yourself
const rows = [];
for (const order of orders) {
  rows.push([order.id, order.customer, "", ""]);
  for (const line of order.lines) {
    rows.push(["", "", line.product, line.qty]);
  }
}

// Row offsets tracked manually.
// Parent/child intent is split across loops.`,
    afterCode: `createExcelSchema<Order>()
  .column("id", { accessor: "id" })
  .column("customer", { accessor: "customer" })
  .column("product", {
    accessor: (row) => row.lines.map((line) => line.product),
  })
  .column("qty", {
    accessor: (row) => row.lines.map((line) => line.qty),
  });

// Array accessors expand the logical row automatically.
// Single-value columns are merged for you.`,
  },
  {
    id: "excel-table-mode",
    eyebrow: "Excel table mode",
    title: "Native Excel tables, not styled ranges",
    body: "Emit real ListObject tables with structured refs, SUBTOTAL() totals that respect active filters, and 60 built-in style presets — from the same schema API.",
    docsPath: "/excel-table-mode/overview",
    beforeCode: `// Style cells to look table-like
worksheet["A1"] = "Revenue";
worksheet["E22"] = { f: "SUM(E2:E21)" };

// No native table object in the workbook.
// Totals ignore active filters.
// Structured refs are unavailable.`,
    afterCode: `createExcelSchema<OrderRow>({ mode: "excel-table" })
  .column("units", {
    accessor: "units",
  })
  .column("revenue", {
    accessor: "revenue",
    totalsRow: { function: "sum" },
  })
  .column("avgPrice", {
    formula: ({ row, fx }) =>
      fx.round(row.ref("revenue").div(row.ref("units")), 2),
  })
  .build();

// Totals become SUBTOTAL(). Structured refs stay readable.`,
  },
  {
    id: "conditional-styles",
    eyebrow: "Typed styling",
    title: "Conditional formatting with full row-type inference",
    body: "Style cells using typed row access and formula-based conditions. Rules translate to native Excel conditional formatting — they stay live when the file opens.",
    docsPath: "/schema-builder/conditional-styles",
    beforeCode: `// SheetJS: style decisions happen against raw worksheet state
const cellRef = XLSX.utils.encode_cell({ r, c });
const status = rawRows[r - 1]?.status;
ws[cellRef].s = {
  font: {
    bold: status === "overdue",
    color: { rgb: "B42318" },
  },
};

// Row type is lost at the point of styling.`,
    afterCode: `.column("status", {
  accessor: "status",
  conditionalStyle: (conditional) =>
    conditional
      .when(({ row }) => row.ref("status").eq("paid"), {
        fill: { color: { rgb: "DCFCE7" } },
        font: { color: { rgb: "166534" }, bold: true },
      })
      .when(({ row }) => row.ref("status").eq("overdue"), {
        fill: { color: { rgb: "FEE2E2" } },
        font: { color: { rgb: "991B1B" }, bold: true },
      }),
});

// Rules stay live in Excel after the file opens.`,
  },
  {
    id: "column-selection",
    eyebrow: "Column selection",
    title: "Include or exclude columns without forking the schema",
    body: "Pass a typed select or exclude list at the table call site. One schema definition powers every export variant — column IDs are checked at compile time.",
    docsPath: "/schema-builder/selection",
    beforeCode: `// SheetJS: maintain separate export column lists
const cols = baseColumns.filter((col) => {
  if (col.key === "internalCode" && !isAdmin) return false;
  if (col.key === "euVat" && region !== "EU") return false;
  return true;
});

// Type inference breaks after filter().
// Schema logic is split across two places.`,
    afterCode: `const schema = createExcelSchema<Row>()
  .column("company", { accessor: "company" })
  .column("revenue", { accessor: "revenue" })
  .column("internalCode", { accessor: "internalCode" })
  .column("euVat", { accessor: "euVat" })
  .build();

workbook.sheet("External").table("accounts", {
  rows,
  schema,
  select: { exclude: ["internalCode", "euVat"] },
});

// One schema, multiple export shapes, typed column IDs.`,
  },
  {
    id: "workflow-safe",
    eyebrow: "Editable workflows",
    title: "User-editable workbooks that still protect logic",
    body: "Unlock specific input cells, lock formulas, add data validation, and hide computation columns — all declared in the schema alongside the rest of the report definition.",
    docsPath: "/schema-builder/data-validation",
    beforeCode: `// Ship an editable workbook
worksheet["F2"].v = proposedValue;

// No validation guardrails.
// Hidden logic columns easy to expose.
// Users can overwrite formulas accidentally.`,
    afterCode: `.column("targetArr", {
  accessor: "targetArr",
  style: { protection: { locked: false } },
  validation: (v) => v.integer().between(10000, 3000000),
})
.column("uplift", {
  formula: ({ row }) =>
    row.ref("targetArr").div(row.ref("currentArr")),
  style: { protection: { hidden: true } },
});

// Pair with sheet protection and editable inputs stay unlocked.`,
  },
  {
    id: "multi-sheet",
    eyebrow: "Workbook builder",
    title: "Multi-sheet workbooks from a single fluent chain",
    body: "Compose sheets, tables, and output targets in one pipeline. No worksheet object management, no manual append ordering.",
    docsPath: "/workbook-builder/buffered-workbook",
    beforeCode: `// SheetJS: every worksheet is a separate construction path
const wb  = XLSX.utils.book_new();
const ws1 = buildSheet(summaryRows);
const ws2 = buildSheet(detailRows);

XLSX.utils.book_append_sheet(wb, ws1, "Summary");
XLSX.utils.book_append_sheet(wb, ws2, "Details");

// Each sheet is a separate construction path.`,
    afterCode: `createWorkbook()
  .sheet("Summary", { freezePane: { rows: 1 } })
  .table("summary", { schema: summarySchema, rows })
  .sheet("Details", { freezePane: { rows: 1 } })
  .table("details", { schema: detailSchema, rows })
  .writeToFile("./report.xlsx");

// One builder. Two sheets. Same ergonomics.`,
  },
  {
    id: "streaming-scale",
    eyebrow: "Streaming builder",
    title: "Same schema, production-scale output",
    body: "Keep every schema feature intact, then switch to batch commits when the dataset outgrows memory. Heap stays flat while the ZIP is assembled incrementally.",
    docsPath: "/streaming/overview",
    beforeCode: `// SheetJS: stream-like export still means manual worksheet writes
const ws = XLSX.utils.aoa_to_sheet([headers]);
let rowIndex = 1;

for await (const batch of fetchRows()) {
  for (const row of batch) {
    XLSX.utils.sheet_add_aoa(ws, [[
      row.orderId,
      row.customer,
      row.total,
    ]], { origin: { r: rowIndex, c: 0 } });

    rowIndex += 1;
  }
}

// Full worksheet state stays in memory.
// No schema reuse, formulas, summaries, or autoWidth layer.`,
    afterCode: `const schema = createExcelSchema<Order>()
  .column("orderId", { accessor: "orderId", autoWidth: true })
  .column("customer", { accessor: "customer", autoWidth: true })
  .column("total", {
    accessor: "total",
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  .build();

// Buffered: same schema for smaller exports
createWorkbook().sheet("Orders").table("orders", { rows, schema });

// Streaming: same schema for large exports
const table = await createWorkbookStream().sheet("Orders").table("orders", { schema });
for await (const batch of fetchRows()) await table.commit({ rows: batch });`,
  },
];

const activeIndex = ref(0);
const progress = ref(0); // 0–1, drives the bar width directly
const isPaused = ref(false);

let rafId: number | undefined;
let lastTimestamp: number | undefined;

const activeStory = computed(() => stories[activeIndex.value] ?? stories[0]!);
const codeTheme = computed(() => (colorMode.value === "dark" ? "vitesse-dark" : "vitesse-light"));

function advance() {
  activeIndex.value = (activeIndex.value + 1) % stories.length;
  progress.value = 0;
  lastTimestamp = undefined;
}

function tick(now: number) {
  if (!isPaused.value) {
    if (lastTimestamp !== undefined) {
      const delta = now - lastTimestamp;
      progress.value += delta / DURATION;
      if (progress.value >= 1) {
        advance();
      }
    }
    lastTimestamp = now;
  }
  rafId = requestAnimationFrame(tick);
}

function selectStory(index: number) {
  activeIndex.value = index;
  progress.value = 0;
  lastTimestamp = undefined;
}

function goToPrevious() {
  selectStory((activeIndex.value - 1 + stories.length) % stories.length);
}

function pauseTimer() {
  isPaused.value = true;
  lastTimestamp = undefined; // discard stale timestamp so resume doesn't jump
}

function resumeTimer() {
  isPaused.value = false;
  lastTimestamp = undefined; // next tick starts a fresh delta
}

function onVisibilityChange() {
  if (document.hidden) {
    // Tab hidden — freeze progress, stop accumulating deltas
    lastTimestamp = undefined;
  } else {
    // Tab visible again — just let next rAF pick up cleanly
    lastTimestamp = undefined;
  }
}

onMounted(() => {
  rafId = requestAnimationFrame(tick);
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onBeforeUnmount(() => {
  if (rafId !== undefined) cancelAnimationFrame(rafId);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<template>
  <section class="mx-auto mt-16 max-w-[90rem] px-4 sm:mt-24 sm:px-6 lg:mt-28 lg:px-8">
    <div class="mb-10 space-y-3 sm:mb-12 lg:mb-14">
      <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
        Feature Surface
      </p>
      <h2
        class="text-balance text-3xl font-bold tracking-tight text-highlighted sm:text-4xl lg:text-5xl"
      >
        Depth where reports<br />actually get
        <em class="not-italic text-primary">hard.</em>
      </h2>
    </div>

    <div class="overflow-hidden rounded-[1.75rem] border border-default/60">
      <div class="border-b border-default/40 bg-elevated/20 px-5 py-5 sm:px-7 sm:py-6">
        <Transition name="story" mode="out-in">
          <div
            :key="activeStory.id"
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div class="min-w-0 flex-1">
              <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
                {{ activeStory.eyebrow }}
              </p>
              <h3 class="mt-2 text-xl font-bold text-highlighted sm:text-2xl">
                {{ activeStory.title }}
              </h3>
              <p class="mt-2 max-w-3xl text-sm leading-7 text-toned sm:text-base">
                {{ activeStory.body }}
              </p>
            </div>
            <div class="shrink-0 pt-0.5">
              <UButton
                :to="activeStory.docsPath"
                color="neutral"
                variant="ghost"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
                class="border border-default/50"
              >
                Read docs
              </UButton>
            </div>
          </div>
        </Transition>
      </div>

      <div
        class="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch"
        @mouseenter="pauseTimer"
        @mouseleave="resumeTimer"
      >
        <div
          class="relative flex min-h-[23rem] flex-col border-b border-default/60 bg-elevated/20 p-5 sm:min-h-[25rem] sm:p-6 lg:min-h-[27rem] lg:border-b-0 lg:border-r lg:p-8"
        >
          <div class="mb-5 flex items-center gap-3">
            <span class="flex size-6 items-center justify-center rounded-full bg-red-500/15">
              <UIcon name="i-lucide-x" class="size-3.5 text-red-400" />
            </span>
            <span class="font-mono text-xs font-semibold uppercase tracking-widest text-red-400/80"
              >Without typed-xlsx</span
            >
          </div>
          <div class="value-code-stack">
            <MdcCodeBlock
              v-for="story in stories"
              v-show="story.id === activeStory.id"
              :key="`${story.id}-before-${codeTheme}`"
              :code="story.beforeCode"
              lang="ts"
              :theme="codeTheme"
              class="value-code-block value-code-block--before"
            />
          </div>
        </div>

        <div
          class="relative flex min-h-[23rem] flex-col bg-elevated/10 p-5 sm:min-h-[25rem] sm:p-6 lg:min-h-[27rem] lg:p-8"
        >
          <div class="mb-5 flex items-center gap-3">
            <span class="flex size-6 items-center justify-center rounded-full bg-primary/15">
              <UIcon name="i-lucide-check" class="size-3.5 text-primary" />
            </span>
            <span class="font-mono text-xs font-semibold uppercase tracking-widest text-primary/80"
              >With typed-xlsx</span
            >
          </div>
          <div class="value-code-stack">
            <MdcCodeBlock
              v-for="story in stories"
              v-show="story.id === activeStory.id"
              :key="`${story.id}-after-${codeTheme}`"
              :code="story.afterCode"
              lang="ts"
              :theme="codeTheme"
              class="value-code-block value-code-block--after"
            />
          </div>
        </div>
      </div>

      <div class="border-t border-default/40 bg-elevated/5 px-5 py-4 sm:px-6 sm:py-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-toned/60">
            10 SheetJS-to-schema examples
          </p>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              @click="goToPrevious"
            />
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-arrow-right"
              @click="selectStory((activeIndex + 1) % stories.length)"
            />
          </div>
        </div>

        <div class="dash-track" role="tablist" aria-label="Feature examples">
          <button
            v-for="(story, i) in stories"
            :key="story.id"
            :class="[
              'dash',
              i === activeIndex ? 'dash--active' : i < activeIndex ? 'dash--past' : 'dash--future',
            ]"
            type="button"
            role="tab"
            :aria-selected="i === activeIndex"
            :aria-label="`Go to ${story.eyebrow}`"
            @click="selectStory(i)"
          >
            <span class="sr-only">{{ story.eyebrow }}: {{ story.title }}</span>
            <div
              v-if="i === activeIndex"
              class="dash__fill dash__fill--active"
              :style="{ transform: `scaleX(${progress})` }"
            />
            <div v-else-if="i < activeIndex" class="dash__fill dash__fill--complete" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.value-code-block {
  display: block;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.value-code-stack {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
}

.value-code-block:deep(pre.shiki) {
  margin: 0;
  display: block;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-height: 0;
  min-width: 100%;
  overflow: auto;
  border-radius: 0.75rem;
  padding: 1rem 1rem 1.2rem;
  font-size: 0.76rem;
  line-height: 1.85;
  background: transparent !important;
  box-shadow: none;
}

.value-code-block--before:deep(pre.shiki) {
  border: 1px solid rgb(239 68 68 / 0.3);
  box-shadow: inset 0 0 0 1px rgb(239 68 68 / 0.08);
}

.value-code-block--after:deep(pre.shiki) {
  border: 1px solid color-mix(in oklab, var(--ui-primary) 34%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ui-primary) 10%, transparent);
}

.value-code-block:deep(code) {
  display: block;
}

.value-code-block:deep(.line) {
  min-height: 1.75em;
}

.dash-track {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  align-items: center;
  gap: 0.5rem;
}

.dash {
  position: relative;
  overflow: hidden;
  height: 0.5rem;
  border-radius: 999px;
  border: 0;
  background: color-mix(in oklab, var(--ui-border) 72%, transparent);
  padding: 0;
  transition:
    background 180ms ease,
    opacity 180ms ease;
}

.dash--active {
  background: color-mix(in oklab, var(--ui-primary) 14%, var(--ui-border));
}

.dash--future,
.dash--past {
  opacity: 0.9;
}

.dash__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  transform-origin: left center;
}

.dash__fill--active {
  background: color-mix(in oklab, var(--ui-primary) 72%, transparent);
  will-change: transform;
}

.dash__fill--complete {
  background: color-mix(in oklab, var(--ui-primary) 46%, transparent);
}

.story-enter-active,
.story-leave-active,
.code-enter-active,
.code-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.story-enter-from,
.story-leave-to,
.code-enter-from,
.code-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
