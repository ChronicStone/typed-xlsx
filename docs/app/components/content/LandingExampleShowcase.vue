<script setup lang="ts">
import { codeToHtml } from "shiki";

type ExampleId = "report" | "formulas" | "table" | "composition" | "streaming";

type ExampleDefinition = {
  id: ExampleId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  featurePills: string[];
  outputKind: "workbook" | "grid" | "flow";
  workbookUrl?: string;
  sourceUrl?: string;
  code: string;
  grid?: {
    headers: string[];
    rows: string[][];
    footer?: string[];
    note: string;
  };
  flow?: {
    steps: { index: string; title: string; body: string }[];
    stats: { label: string; value: string; sub: string }[];
  };
};

const EXAMPLES: ExampleDefinition[] = [
  {
    id: "report",
    label: "Typed report",
    eyebrow: "Schema layer",
    title: "Finance report from the domain model — not from cell addresses",
    description:
      "Typed accessors, formula columns with predecessor-checked references, reducer summaries, and per-row conditional styling. One schema, reusable across any number of exports.",
    featurePills: ["schema", "formula DSL", "summary rows", "conditional style"],
    outputKind: "workbook",
    workbookUrl:
      "https://github.com/ChronicStone/typed-xlsx/raw/main/packages/typed-xlsx/examples/financial-report.xlsx",
    sourceUrl:
      "https://github.com/ChronicStone/typed-xlsx/tree/main/packages/typed-xlsx/examples/financial-report-source",
    code: `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type Invoice = {
  id: string;
  customer: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  status: "paid" | "pending" | "overdue";
};

const schema = createExcelSchema<Invoice>()
  .column("id",       { header: "Invoice #",  accessor: "id",        width: 14 })
  .column("customer", { header: "Customer",   accessor: "customer",  minWidth: 20 })
  .column("qty",      { header: "Qty",        accessor: "qty",       width: 8 })
  .column("price",    {
    header: "Unit Price",
    accessor: "unitPrice",
    style: { numFmt: "$#,##0.00" },
  })
  // Formula — type-checked: row.ref("qty") and row.ref("price") must be declared above
  .column("subtotal", {
    header: "Subtotal",
    formula: ({ row, fx }) => fx.round(row.ref("qty").mul(row.ref("price")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],   // live =SUM(E2:E100)
  })
  .column("tax", {
    header: "Tax",
    formula: ({ row, fx }) => fx.round(row.ref("subtotal").mul(row.ref("taxRate")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  .column("total", {
    header: "Total",
    formula: ({ row }) => row.ref("subtotal").add(row.ref("tax")),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  .column("status", {
    header: "Status",
    accessor: "status",
    style: (row) => ({                       // full type inference on row
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
  .table("invoices", { rows, schema, title: "Invoice Report — Q1 2025" });`,
  },
  {
    id: "formulas",
    label: "Groups + formulas",
    eyebrow: "Formula layer",
    title: "Runtime column groups that still participate in typed formulas",
    description:
      "Generate one column per region / org / category from a typed context value. The context shape is inferred from your callback — wrong type is a compile error. Formula aggregates across the full group work identically.",
    featurePills: ["dynamic groups", "typed context", "group aggregates", "formula scope"],
    outputKind: "grid",
    sourceUrl:
      "https://github.com/ChronicStone/typed-xlsx/tree/main/packages/typed-xlsx/examples/kitchen-sink-source",
    code: `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type RegionalRevenue = {
  customerName: string;
  revenueByRegion: Record<string, number>;
};

const schema = createExcelSchema<RegionalRevenue>({ mode: "excel-table" })
  .column("customerName", { header: "Customer", accessor: "customerName" })

  // One column per region — generated at table-build time from context
  .group("regions", (group, regions: string[]) => {
    for (const region of regions) {
      group.column(region, {
        header: region,
        accessor: (row) => row.revenueByRegion[region] ?? 0,
        style: { numFmt: "$#,##0" },
        totalsRow: { function: "sum" },
      });
    }
  })

  // Aggregates ALL generated columns — works even though count is runtime
  .column("globalTotal", {
    header: "Global Total",
    formula: ({ row }) => row.group("regions").sum(),
    style: { numFmt: "$#,##0", font: { bold: true } },
    totalsRow: { function: "sum" },
  })
  .build();

// context: { regions: string[] } is inferred from the group callback parameter.
// Supplying the wrong type, or omitting context entirely, is a TypeScript error.
createWorkbook().sheet("Revenue").table("revenue", {
  rows,
  schema,
  context: { regions: ["AMER", "APAC", "EMEA"] },
  totalsRow: true,
  style: "TableStyleMedium6",
});`,
    grid: {
      headers: ["Customer", "AMER", "APAC", "EMEA", "Global Total"],
      rows: [
        ["Acme Capital", "$48,200", "$19,400", "$31,800", "$99,400"],
        ["Northwind Ops", "$22,400", "$14,200", "$18,700", "$55,300"],
        ["Atlas Health", "$36,100", "$29,500", "$24,800", "$90,400"],
        ["Meridian Corp", "$31,600", "$22,100", "$17,500", "$71,200"],
      ],
      footer: ["Total", "$138,300", "$85,200", "$92,800", "$316,300"],
      note: "The region list changes at runtime. The schema is static. The context object shape is inferred — pass the wrong type and TypeScript tells you before the build runs.",
    },
  },
  {
    id: "table",
    label: "Excel table mode",
    eyebrow: "Workbook layer",
    title: "Native Excel tables — autoFilter, SUBTOTAL totals, 60 style presets",
    description:
      'Switch output contract with mode: "excel-table". Same schema authoring style — formulas now emit structured references ([@Column]), totals use SUBTOTAL() so they respect active filters.',
    featurePills: ["excel-table mode", "totals row", "structured refs", "60 style presets"],
    outputKind: "workbook",
    workbookUrl:
      "https://github.com/ChronicStone/typed-xlsx/raw/main/packages/typed-xlsx/examples/kitchen-sink-buffered.xlsx",
    sourceUrl:
      "https://github.com/ChronicStone/typed-xlsx/blob/main/packages/typed-xlsx/examples/kitchen-sink-source/buffered.ts",
    code: `import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type OrderRow = {
  orderId: string;
  customerName: string;
  region: string;
  units: number;
  unitCost: number;
  revenue: number;
  createdAt: string;
};

// mode: "excel-table" — emits a native <table> object, not a styled range
const schema = createExcelSchema<OrderRow>({ mode: "excel-table" })
  .column("orderId",      { header: "Order",    accessor: "orderId",
                            totalsRow: { label: "TOTAL" } })
  .column("customer",     { header: "Customer", accessor: "customerName" })
  .column("region",       { header: "Region",   accessor: "region" })
  .column("units",        { header: "Units",    accessor: "units",
                            totalsRow: { function: "sum" } })
  .column("revenue",      {
    header: "Revenue",
    accessor: "revenue",
    style: { numFmt: "$#,##0.00" },
    totalsRow: { function: "sum" },        // → SUBTOTAL(9, [Revenue])
  })
  // Structured ref: =ROUND([@Revenue]/[@Units], 2) — self-documenting
  .column("avgPrice", {
    header: "Avg Price",
    formula: ({ row, fx }) => fx.round(row.ref("revenue").div(row.ref("units")), 2),
    style: { numFmt: "$#,##0.00" },
    totalsRow: { label: "—" },
  })
  .column("createdAt",   { header: "Created",  accessor: "createdAt",
                            totalsRow: { function: "max" } })
  .build();

createWorkbook().sheet("Orders").table("orders", {
  rows,
  schema,
  name: "OrdersTable",
  style: "TableStyleMedium6",   // Light1-21, Medium1-28, Dark1-11
  totalsRow: true,
  autoFilter: true,
});`,
  },
  {
    id: "composition",
    label: "Workbook composition",
    eyebrow: "Workbook layer",
    title: "Multi-sheet workbooks composed like a reporting system",
    description:
      "Place multiple tables on one sheet with grid controls, select column subsets per export, freeze panes, and ship RTL sheets — all from the same reusable schema definitions.",
    featurePills: ["multi-sheet", "column selection", "tablesPerRow", "freeze panes", "RTL"],
    outputKind: "grid",
    sourceUrl:
      "https://github.com/ChronicStone/typed-xlsx/blob/main/packages/typed-xlsx/examples/kitchen-sink-source/buffered.ts",
    code: `import { createWorkbook } from "@chronicstone/typed-xlsx";

const workbook = createWorkbook();

// Sheet 1: two tables side by side, frozen header + columns
workbook
  .sheet("Overview", {
    tablesPerRow: 2,
    tableColumnGap: 2,
    tableRowGap: 2,
    freezePane: { rows: 1, columns: 2 },
  })
  .table("all-orders", {
    title: "All Orders",
    schema: orderSchema,
    rows: orders,
  })
  .table("enterprise", {
    title: "Enterprise Accounts",
    schema: orderSchema,
    rows: orders.filter((o) => o.customer.tier === "enterprise"),
    // select.include is typed — only declared column IDs compile
    select: { include: ["orderId", "customerName", "revenue", "createdAt"] },
  });

// Sheet 2: analyst export — cost columns hidden
workbook.sheet("External Report").table("external", {
  title: "External View",
  schema: orderSchema,
  rows: orders,
  select: { exclude: ["unitCost", "margin"] },
});

// Sheet 3: RTL locale delivery — same schema, different sheet view
workbook.sheet("تقرير", { rightToLeft: true }).table("rtl", {
  schema: orderSchema,
  rows: orders.slice(0, 10),
});

await workbook.writeToFile("./report.xlsx");`,
    grid: {
      headers: ["Sheet", "Tables", "Key options"],
      rows: [
        ["Overview", "2 side-by-side", "tablesPerRow: 2 · freezePane · column gaps"],
        ["External Report", "1 filtered", "select.exclude: ['unitCost', 'margin']"],
        ["تقرير (RTL)", "1 localized", "rightToLeft: true · same schema"],
      ],
      note: "The schema is defined once and carries no workbook state. Pass it with different select options to produce full, filtered, or role-scoped exports from a single chain.",
    },
  },
  {
    id: "streaming",
    label: "Streaming export",
    eyebrow: "Scale layer",
    title: "Same schema. Streaming builder. Flat memory at any dataset size.",
    description:
      "Switch from createWorkbook() to createWorkbookStream() and commit rows in batches. The spool writes incrementally to disk. The ZIP is assembled as a stream. Formula columns, table mode, groups, and summaries all work identically.",
    featurePills: ["streaming", "batch commit", "bounded memory", "output targets"],
    outputKind: "flow",
    sourceUrl:
      "https://github.com/ChronicStone/typed-xlsx/blob/main/packages/typed-xlsx/examples/financial-report-source/stream.ts",
    code: `import { createWorkbookStream } from "@chronicstone/typed-xlsx";

// Same schema objects — no changes needed when switching to streaming
const workbook = createWorkbookStream({ tempStorage: "file" });

const table = await workbook
  .sheet("Orders", { freezePane: { rows: 1 } })
  .table("orders", { schema: orderSchema });

// Pull rows from a DB cursor, paginated API, or async generator
async function* fetchOrdersFromDatabase() {
  let offset = 0;
  while (true) {
    const batch = await db.query(
      "SELECT * FROM orders ORDER BY id LIMIT 1000 OFFSET ?",
      [offset],
    );
    if (batch.length === 0) break;
    yield batch;
    offset += batch.length;
  }
}

for await (const batch of fetchOrdersFromDatabase()) {
  await table.commit({ rows: batch });
  // Each batch is serialized to the spool and freed.
  // Heap usage stays flat — total row count never accumulates.
}

// Finalize: summaries appended, ZIP assembled by streaming the spool.
// The compressor never holds the full workbook in memory.
await workbook.writeToFile("./orders-export.xlsx");

// Other output targets — same API:
// await workbook.pipeToNode(res);          // Node.js HTTP response
// await workbook.pipeTo(writableStream);   // Web WritableStream
// const readable = workbook.toNodeReadable();
// const webStream = workbook.toReadableStream();`,
    flow: {
      steps: [
        {
          index: "01",
          title: "Commit row batches",
          body: "table.commit({ rows: batch }) serializes each batch to OOXML and appends it to the spool. The batch is freed after each call.",
        },
        {
          index: "02",
          title: "Plan and serialize incrementally",
          body: "Sub-row expansion, column widths, formula refs, and summary accumulators are all resolved batch by batch.",
        },
        {
          index: "03",
          title: "Assemble the ZIP as a stream",
          body: "At finalization, summaries are appended and the archive is built by streaming the spool through the compressor — no full workbook in heap.",
        },
      ],
      stats: [
        { label: "Buffered target", value: "~50k", sub: "rows in heap" },
        { label: "Streaming target", value: "∞", sub: "unbounded" },
        { label: "Output targets", value: "4", sub: "file · node · web" },
      ],
    },
  },
] as const;

// ─── Rendering ──────────────────────────────────────────────────────────────

type RenderedExample = Omit<ExampleDefinition, "code"> & {
  html: { dark: string; light: string };
};

const colorMode = useColorMode() as { value: string };
const isDark = computed(() => colorMode.value === "dark");
const activeId = ref<ExampleId>("report");
const iframeFailed = ref(false);

const rendered = useState<RenderedExample[]>("typed-xlsx-showcase-v2", () => []);

if (rendered.value.length === 0) {
  rendered.value = await Promise.all(
    EXAMPLES.map(async ({ code, ...rest }) => ({
      ...rest,
      html: {
        light: await codeToHtml(code, { lang: "ts", theme: "github-light" }),
        dark: await codeToHtml(code, { lang: "ts", theme: "github-dark" }),
      },
    })),
  );
}

const current = computed(
  () => rendered.value.find((e) => e.id === activeId.value) ?? rendered.value[0],
);

const codeHtml = computed(() =>
  isDark.value ? current.value.html.dark : current.value.html.light,
);

const iframeUrl = computed(() => {
  if (!current.value.workbookUrl) return "";
  const url = new URL(current.value.workbookUrl);
  url.searchParams.set("preview", "landing-v2");
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url.toString())}&action=embedview&wdHideGridlines=True&wdHideHeaders=True&wdAllowInteractivity=False`;
});

watch(activeId, () => {
  iframeFailed.value = false;
});
</script>

<template>
  <UPageCard
    spotlight
    class="showcase-card overflow-hidden rounded-[1.75rem] border border-default/60 bg-default/95"
  >
    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="showcase-header border-b border-default/40 px-4 py-4 sm:px-6 sm:py-5">
      <!-- Eyebrow + pills row -->
      <div class="mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <p class="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
          {{ current.eyebrow }}
        </p>
        <div class="flex min-w-0 flex-wrap items-center gap-1">
          <UBadge
            v-for="pill in current.featurePills"
            :key="pill"
            color="neutral"
            variant="subtle"
            class="rounded-full font-mono text-[9px] sm:text-[10px]"
          >
            {{ pill }}
          </UBadge>
        </div>
      </div>
      <!-- Title: clamp to 2 lines on mobile, full on larger -->
      <h3
        class="line-clamp-2 text-sm font-bold text-highlighted sm:line-clamp-none sm:text-base lg:text-lg"
      >
        {{ current.title }}
      </h3>
      <!-- Description: hidden on mobile to save space -->
      <p
        class="mt-1 hidden max-w-2xl text-pretty text-xs leading-5 text-toned sm:block sm:leading-6"
      >
        {{ current.description }}
      </p>
    </div>

    <!-- ── Tabs ──────────────────────────────────────────────────── -->
    <div
      class="showcase-tabs border-b border-default/40 flex items-center gap-1 overflow-x-auto px-4 py-2 sm:px-5"
    >
      <button
        v-for="ex in rendered"
        :key="ex.id"
        type="button"
        class="showcase-tab shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors duration-150"
        :class="
          activeId === ex.id
            ? 'bg-primary/12 text-primary'
            : 'text-toned hover:bg-elevated/80 hover:text-highlighted'
        "
        @click="activeId = ex.id"
      >
        <span
          v-if="activeId === ex.id"
          class="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle"
        />
        {{ ex.label }}
      </button>

      <!-- spacer + action buttons pinned to the right -->
      <div class="ml-auto flex shrink-0 items-center gap-2 pl-4">
        <UButton
          v-if="current.sourceUrl"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-simple-icons-github"
          :to="current.sourceUrl"
          target="_blank"
          class="border border-default/50"
        >
          Source
        </UButton>
        <UButton
          v-if="current.workbookUrl"
          color="primary"
          variant="soft"
          size="xs"
          icon="i-lucide-download"
          :to="current.workbookUrl"
          target="_blank"
        >
          Workbook
        </UButton>
      </div>
    </div>

    <!-- ── Code | Output split ───────────────────────────────────── -->
    <div class="showcase-split grid grid-cols-1 lg:grid-cols-2">
      <!-- Code pane -->
      <div
        class="showcase-code-pane border-b border-default/40 overflow-auto lg:border-b-0 lg:border-r"
      >
        <div class="showcase-code" v-html="codeHtml" />
      </div>

      <!-- Output pane -->
      <div class="showcase-output-pane flex flex-col bg-elevated/25">
        <!-- Output pane header -->
        <div class="shrink-0 border-b border-default/40 px-5 py-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
            Output preview
          </p>
        </div>

        <!-- Output pane content — fills remaining height -->
        <div class="showcase-output-content min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          <!-- Workbook iframe -->
          <template v-if="current.outputKind === 'workbook'">
            <div class="h-full overflow-hidden rounded-xl border border-default/50 bg-default">
              <iframe
                v-if="!iframeFailed"
                :src="iframeUrl"
                class="h-full w-full border-0 bg-default"
                loading="lazy"
                title="Workbook preview"
                @error="iframeFailed = true"
              />
              <div
                v-else
                class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <UIcon name="i-lucide-table-2" class="size-10 text-toned/40" />
                <p class="max-w-sm text-pretty text-sm leading-6 text-toned">
                  Microsoft's viewer couldn't load here. Download the workbook or view the source to
                  explore the output.
                </p>
                <div class="flex flex-wrap justify-center gap-2">
                  <UButton
                    v-if="current.workbookUrl"
                    color="primary"
                    size="sm"
                    icon="i-lucide-download"
                    :to="current.workbookUrl"
                    target="_blank"
                  >
                    Download workbook
                  </UButton>
                  <UButton
                    v-if="current.sourceUrl"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-simple-icons-github"
                    :to="current.sourceUrl"
                    target="_blank"
                  >
                    View source
                  </UButton>
                </div>
              </div>
            </div>
          </template>

          <!-- Grid preview -->
          <template v-else-if="current.outputKind === 'grid' && current.grid">
            <div class="flex h-full flex-col gap-4">
              <div class="overflow-hidden rounded-xl border border-default/50 bg-default">
                <div class="overflow-x-auto">
                  <table class="min-w-full border-collapse text-sm">
                    <thead>
                      <tr class="border-b border-default/60 bg-elevated/60">
                        <th
                          v-for="h in current.grid.headers"
                          :key="h"
                          class="px-4 py-3 text-left font-semibold text-highlighted first:pl-5"
                        >
                          {{ h }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, i) in current.grid.rows"
                        :key="`r${i}`"
                        class="border-b border-default/40 last:border-b-0 hover:bg-elevated/40 transition-colors"
                      >
                        <td
                          v-for="(cell, j) in row"
                          :key="`c${j}`"
                          class="px-4 py-2.5 text-sm first:pl-5"
                          :class="
                            j === 0 ? 'font-medium text-highlighted' : 'text-toned tabular-nums'
                          "
                        >
                          {{ cell }}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot v-if="current.grid.footer">
                      <tr class="border-t border-default/60 bg-primary/5">
                        <td
                          v-for="(cell, j) in current.grid.footer"
                          :key="`f${j}`"
                          class="px-4 py-3 text-sm font-bold first:pl-5"
                          :class="j === 0 ? 'text-highlighted' : 'text-primary tabular-nums'"
                        >
                          {{ cell }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div class="rounded-xl border border-default/40 bg-elevated/40 px-4 py-3">
                <p class="text-xs leading-5 text-toned">{{ current.grid.note }}</p>
              </div>
            </div>
          </template>

          <!-- Flow preview -->
          <template v-else-if="current.outputKind === 'flow' && current.flow">
            <div class="flex h-full flex-col gap-4">
              <!-- Steps -->
              <div class="grid gap-3">
                <div
                  v-for="step in current.flow.steps"
                  :key="step.index"
                  class="flex items-start gap-4 rounded-xl border border-default/40 bg-elevated/40 px-4 py-4"
                >
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/8 font-mono text-xs font-bold text-primary"
                  >
                    {{ step.index }}
                  </span>
                  <div>
                    <p class="text-sm font-semibold text-highlighted">{{ step.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-toned">{{ step.body }}</p>
                  </div>
                </div>
              </div>
              <!-- Stats -->
              <div class="mt-auto grid grid-cols-3 gap-3">
                <div
                  v-for="stat in current.flow.stats"
                  :key="stat.label"
                  class="rounded-xl border border-default/40 bg-elevated/60 px-4 py-4"
                >
                  <p class="font-mono text-[10px] uppercase tracking-widest text-primary/60">
                    {{ stat.label }}
                  </p>
                  <p class="mt-2 text-2xl font-bold tabular-nums text-primary">{{ stat.value }}</p>
                  <p class="mt-0.5 text-xs text-toned">{{ stat.sub }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </UPageCard>
</template>

<style scoped>
/* ── Fixed height budget for the split section ──────────────────── */
.showcase-split {
  /* Each pane gets this exact height — overflow handled internally */
  --pane-height: 580px;
}

.showcase-code-pane {
  height: var(--pane-height);
  overflow: auto;
}

.showcase-output-pane {
  height: var(--pane-height);
  /* flex-col is on the element, flex-1 + min-h-0 on the content */
}

.showcase-output-content {
  /* Fills the pane minus the output header (~40px) */
  height: calc(var(--pane-height) - 40px);
  overflow: auto;
}

/* Tablet: medium height */
@media (max-width: 1023px) {
  .showcase-split {
    --pane-height: 460px;
  }
}

/* Mobile: shorter */
@media (max-width: 639px) {
  .showcase-split {
    --pane-height: 360px;
  }

  .showcase-code :deep(pre) {
    padding: 1rem 1.25rem;
  }

  .showcase-code :deep(code) {
    font-size: 0.7rem;
  }
}

/* ── Code block shiki styles ────────────────────────────────────── */
.showcase-code :deep(pre) {
  margin: 0;
  border: none;
  background: transparent !important;
  padding: 1.25rem 1.5rem;
  overflow: visible; /* parent handles overflow */
}

.showcase-code :deep(code) {
  font-size: 0.78rem;
  line-height: 1.8;
  display: block;
  min-width: max-content; /* allow horizontal scroll on parent */
}

.showcase-code :deep(.line) {
  white-space: pre;
  min-height: 1.5em;
}

/* ── Tab scrollbar hidden but functional ────────────────────────── */
.showcase-tabs {
  scrollbar-width: none;
}
.showcase-tabs::-webkit-scrollbar {
  display: none;
}
</style>
