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

const AUTO_ADVANCE_MS = 12000;

const stories: ValueStoryCard[] = [
  {
    id: "formula-refs",
    eyebrow: "Formula DSL",
    title: "Column refs instead of fragile cell addresses",
    body: "Write formulas against column IDs and let the engine resolve the final Excel coordinates. Layout changes stop being a formula maintenance event.",
    docsPath: "/formulas/formula-columns",
    beforeCode:
      "// Formula for a single cell — you write the address\n" +
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
    title: "Live footer formulas without range arithmetic",
    body: "Attach sums and averages to the schema itself instead of hand-assembling footer ranges every time a report grows or shifts.",
    docsPath: "/formulas/summary-formulas",
    beforeCode:
      "// Append a totals row after the data\n" +
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
    title: "Runtime columns with typed context",
    body: "Generate report layout from runtime inputs and still keep formulas, totals, and context strongly typed and readable.",
    docsPath: "/schema-builder/column-groups",
    beforeCode: `// Build columns manually from runtime data
for (const region of regions) {
  columns.push({
    key: region,
    value: row.revenueByRegion?.[region] ?? 0,
  });
}

// Totals depend on ad hoc index arithmetic.
// Wrong context shape breaks later at runtime.`,
    afterCode: `.group("regions", (group, regions: string[]) => {
  for (const region of regions) {
    group.column(region, {
      accessor: (row) => row.revenueByRegion[region] ?? 0,
    });
  }
})
.column("regionalTotal", {
  formula: ({ row }) => row.group("regions").sum(),
});

// Dynamic layout, still declarative schema code.`,
  },
  {
    id: "sub-rows",
    eyebrow: "Sub-row expansion",
    title: "Nested records without manual row-offset bookkeeping",
    body: "Expand child collections into typed sub-rows while keeping parent structure readable and formula references coherent.",
    docsPath: "/schema-builder/defining-columns",
    beforeCode: `// Expand parent + child rows manually
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
  .subRows("lines", (sub) =>
    sub
      .column("product", { accessor: "product" })
      .column("qty", { accessor: "qty" }),
  );

// Offsets managed by the engine.
// Sub-row type is fully inferred.`,
  },
  {
    id: "excel-table-mode",
    eyebrow: "Excel table mode",
    title: "Real Excel tables, not styled ranges",
    body: "Switch from styled cell ranges to actual Excel table objects with structured refs and totals that respect active filters.",
    docsPath: "/excel-table-mode/overview",
    beforeCode: `// Style cells to look table-like
worksheet["A1"] = "Revenue";
worksheet["E22"] = { f: "SUM(E2:E21)" };

// No native table object in the workbook.
// Totals ignore active filters.
// Structured refs are unavailable.`,
    afterCode: `createExcelSchema<OrderRow>({ mode: "excel-table" })
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
    title: "Cell styling with full row-type inference",
    body: "Express conditional formatting with typed row access instead of reaching back into raw arrays and anonymous cell coordinates.",
    docsPath: "/schema-builder/conditional-styles",
    beforeCode: `// Apply style to a cell based on its value
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
  style: (row) => ({
    font: {
      bold: row.status === "overdue",
      color: {
        rgb: row.status === "paid" ? "166534" : "B42318",
      },
    },
  }),
});

// row.status is typed — typos are compile errors.`,
  },
  {
    id: "column-selection",
    eyebrow: "Column selection",
    title: "Runtime selection without branching the schema",
    body: "Turn columns on and off from typed context instead of filtering separate column arrays at the call site.",
    docsPath: "/schema-builder/selection",
    beforeCode: `// Conditionally include columns at build time
const cols = baseColumns.filter((col) => {
  if (col.key === "internalCode" && !isAdmin) return false;
  if (col.key === "euVat" && region !== "EU") return false;
  return true;
});

// Type inference breaks after filter().
// Schema logic is split across two places.`,
    afterCode: `createExcelSchema<Row, { isAdmin: boolean; region: string }>()
  .column("internalCode", {
    accessor: "internalCode",
    selected: (ctx) => ctx.isAdmin,
  })
  .column("euVat", {
    accessor: "euVat",
    selected: (ctx) => ctx.region === "EU",
  });

// Context is typed. Selection stays in the schema.`,
  },
  {
    id: "workflow-safe",
    eyebrow: "Editable workflows",
    title: "Editable workbooks that still protect logic",
    body: "Let users change intended inputs while validations, protection, and hidden logic remain enforced in the schema layer.",
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

// Inputs stay editable. Logic stays protected.`,
  },
  {
    id: "multi-sheet",
    eyebrow: "Workbook builder",
    title: "Multi-sheet composition from one fluent pipeline",
    body: "Build full workbooks with multiple sheets and tables without managing worksheet objects and append order by hand.",
    docsPath: "/workbook-builder/buffered-workbook",
    beforeCode: `// Add two sheets to a workbook manually
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
    title: "The same schema scales to production-sized exports",
    body: "Keep the schema untouched while the workbook path switches from buffered rows to incremental batch commits.",
    docsPath: "/streaming/overview",
    beforeCode: `// Buffered path — whole dataset in memory
const rows = await loadEntireDataset();

createWorkbook()
  .sheet("Orders")
  .table("orders", { rows, schema });

// Full dataset must fit in process memory.`,
    afterCode: `const table = await createWorkbookStream()
  .sheet("Orders")
  .table("orders", { schema });

for await (const batch of fetchRows()) {
  await table.commit({ rows: batch });
}

// Same schema, different output path, bounded memory.`,
  },
];

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const activeStory = computed(() => stories[activeIndex.value] ?? stories[0]!);
const progressKey = computed(() => `${activeStory.value.id}-${activeIndex.value}`);
const codeTheme = computed(() => (colorMode.value === "dark" ? "vitesse-dark" : "vitesse-light"));

function selectStory(index: number) {
  activeIndex.value = index;
  restartTimer();
}

function goToNext() {
  activeIndex.value = (activeIndex.value + 1) % stories.length;
}

function goToPrevious() {
  activeIndex.value = (activeIndex.value - 1 + stories.length) % stories.length;
  restartTimer();
}

function restartTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(goToNext, AUTO_ADVANCE_MS);
}

onMounted(restartTimer);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
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
        <em class="not-italic text-primary">difficult.</em>
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

      <div class="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch">
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
            10 core examples
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
              :key="progressKey"
              class="dash__fill dash__fill--animated"
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
  min-height: 100%;
}

.value-code-stack {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 100%;
}

.value-code-block:deep(pre.shiki) {
  margin: 0;
  display: block;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-height: 100%;
  min-width: 100%;
  overflow: auto;
  border-radius: 0.75rem;
  padding: 1rem 1rem 1.2rem;
  font-size: 0.76rem;
  line-height: 1.85;
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
  min-height: 100%;
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

.dash__fill--animated {
  background: color-mix(in oklab, var(--ui-primary) 72%, transparent);
  animation: dash-progress 12s linear forwards;
}

.dash__fill--complete {
  background: color-mix(in oklab, var(--ui-primary) 46%, transparent);
}

@keyframes dash-progress {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
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

@media (max-width: 1279px) {
  .dash-track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .dash-track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
